import os
import sys
import struct
import numpy as np

# Add CoppeliaSim ZMQ client to path
sys.path.append(r'C:\Program Files\CoppeliaRobotics\CoppeliaSimEdu\programming\zmqRemoteApi\clients\python\src')
from coppeliasim_zmqremoteapi_client import RemoteAPIClient

def dh_matrix(theta_deg, d, a, alpha_deg):
    th = np.radians(theta_deg)
    al = np.radians(alpha_deg)
    return np.array([
        [np.cos(th), -np.sin(th)*np.cos(al),  np.sin(th)*np.sin(al), a*np.cos(th)],
        [np.sin(th),  np.cos(th)*np.cos(al), -np.cos(th)*np.sin(al), a*np.sin(th)],
        [0,           np.sin(al),             np.cos(al),            d          ],
        [0,           0,                      0,                     1          ]
    ], dtype=np.float64)

def write_binary_stl(filepath, triangles):
    num_triangles = len(triangles)
    with open(filepath, 'wb') as f:
        header = b'Franka Emika Panda Link Mesh for RoboCAD 3D'
        f.write(header + b' ' * (80 - len(header)))
        f.write(struct.pack('<I', num_triangles))
        for v0, v1, v2 in triangles:
            norm = np.cross(v1 - v0, v2 - v0)
            norm_len = np.linalg.norm(norm)
            if norm_len > 1e-9:
                norm = norm / norm_len
            else:
                norm = np.array([0.0, 0.0, 0.0], dtype=np.float32)
            f.write(struct.pack('<12f',
                float(norm[0]), float(norm[1]), float(norm[2]),
                float(v0[0]), float(v0[1]), float(v0[2]),
                float(v1[0]), float(v1[1]), float(v1[2]),
                float(v2[0]), float(v2[1]), float(v2[2])
            ))
            f.write(b'\x00\x00')

def main():
    print('Connecting to CoppeliaSim via ZMQ Remote API...')
    client = RemoteAPIClient()
    sim = client.require('sim')

    # Load Franka Emika Panda
    model_path = r'C:/Program Files/CoppeliaRobotics/CoppeliaSimEdu/models/robots/non-mobile/FrankaEmikaPanda.ttm'
    handle = sim.loadModel(model_path)
    print('Loaded FrankaEmikaPanda handle:', handle)

    # 7 joints of Panda
    joints = [17, 20, 23, 25, 27, 29, 31]
    for j in joints:
        sim.setJointPosition(j, 0.0)
    print('Reset all 7 joints to 0.0 deg zero-posture.')

    # Standard DH parameters for Franka Emika Panda (in mm and degrees):
    # J1: d=333, a=0, alpha=-90
    # J2: d=0, a=0, alpha=90
    # J3: d=316, a=82.5, alpha=90
    # J4: d=0, a=-82.5, alpha=-90
    # J5: d=384, a=0, alpha=90
    # J6: d=0, a=88, alpha=90
    # J7: d=107, a=0, alpha=0
    dh_panda = [
        (0.0, 333.0, 0.0, -90.0),
        (0.0, 0.0, 0.0, 90.0),
        (0.0, 316.0, 82.5, 90.0),
        (0.0, 0.0, -82.5, -90.0),
        (0.0, 384.0, 0.0, 90.0),
        (0.0, 0.0, 88.0, 90.0),
        (0.0, 107.0, 0.0, 0.0)
    ]

    T = np.eye(4, dtype=np.float64)
    T_frames = [T.copy()]
    for th, d, a, al in dh_panda:
        A = dh_matrix(th, d, a, al)
        T = T @ A
        T_frames.append(T.copy())

    print('Calculated DH Frame Origins (mm):')
    for i, F in enumerate(T_frames):
        print(f'  Frame {i}: {np.round(F[:3, 3], 1)}')

    # 8 Links mapped to CoppeliaSim shapes
    link_shapes = [
        [15, 39], # Link 0 (Base)
        [18, 19], # Link 1
        [21, 22], # Link 2
        [24, 38], # Link 3
        [26, 37], # Link 4
        [28, 36], # Link 5
        [30, 35], # Link 6
        [32, 33], # Link 7 (Flange)
    ]

    out_dir = r'Undergraduate\robots\FrankaEmikaPanda'
    os.makedirs(out_dir, exist_ok=True)

    for link_idx, shapes in enumerate(link_shapes):
        inv_T = np.linalg.inv(T_frames[link_idx])
        triangles = []
        for s in shapes:
            mesh_data = sim.getShapeMesh(s)
            raw_v = np.array(mesh_data[0], dtype=np.float64).reshape(-1, 3)
            indices = mesh_data[1]

            m = np.array(sim.getObjectMatrix(s, -1)).reshape(3, 4)
            R_s = m[:3, :3]
            T_s = m[:3, 3]

            # World coordinates in meters
            v_world_m = (R_s @ raw_v.T).T + T_s
            # Scale to mm
            v_world_mm = v_world_m * 1000.0

            # Transform into Link DH Frame
            v_h = np.hstack([v_world_mm, np.ones((len(v_world_mm), 1))])
            v_link = (inv_T @ v_h.T).T[:, :3]

            num_tri = len(indices) // 3
            for t in range(num_tri):
                i0, i1, i2 = indices[t*3], indices[t*3+1], indices[t*3+2]
                triangles.append((v_link[i0], v_link[i1], v_link[i2]))

        stl_path = os.path.join(out_dir, f'link{link_idx}.stl')
        write_binary_stl(stl_path, triangles)
        print(f'Wrote Link {link_idx} ({len(triangles)} triangles) -> {stl_path}')

    # Generate robot.xml
    xml_content = """<?xml version='1.0' encoding='utf-8'?>
<Robot>
  <Name>FrankaEmikaPanda</Name>
  <Scale>1</Scale>
  <Manufacturer>Franka Emika</Manufacturer>
  <ModelName>Panda 7-DOF Research Cobot</ModelName>
  <Payload>3.0</Payload>
  <TotalWeight>18.0</TotalWeight>
  <Links>
    <Link>
      <FileName>link0.stl</FileName>
      <Color>#F8FAFC</Color>
    </Link>
    <Link>
      <FileName>link1.stl</FileName>
      <Color>#E2E8F0</Color>
    </Link>
    <Link>
      <FileName>link2.stl</FileName>
      <Color>#CBD5E1</Color>
    </Link>
    <Link>
      <FileName>link3.stl</FileName>
      <Color>#E2E8F0</Color>
    </Link>
    <Link>
      <FileName>link4.stl</FileName>
      <Color>#CBD5E1</Color>
    </Link>
    <Link>
      <FileName>link5.stl</FileName>
      <Color>#E2E8F0</Color>
    </Link>
    <Link>
      <FileName>link6.stl</FileName>
      <Color>#CBD5E1</Color>
    </Link>
    <Link>
      <FileName>link7.stl</FileName>
      <Color>#38BDF8</Color>
    </Link>
  </Links>
  <Joints>
    <RevoluteJoint>
      <JointOffset>333.0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>0</LinkLength>
      <TwistAngle>-90</TwistAngle>
      <JointAngleMin>-166</JointAngleMin>
      <JointAngleMax>166</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>0</LinkLength>
      <TwistAngle>90</TwistAngle>
      <JointAngleMin>-101</JointAngleMin>
      <JointAngleMax>101</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>316.0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>82.5</LinkLength>
      <TwistAngle>90</TwistAngle>
      <JointAngleMin>-166</JointAngleMin>
      <JointAngleMax>166</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>-82.5</LinkLength>
      <TwistAngle>-90</TwistAngle>
      <JointAngleMin>-176</JointAngleMin>
      <JointAngleMax>-4</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>384.0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>0</LinkLength>
      <TwistAngle>90</TwistAngle>
      <JointAngleMin>-166</JointAngleMin>
      <JointAngleMax>166</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>88.0</LinkLength>
      <TwistAngle>90</TwistAngle>
      <JointAngleMin>-1</JointAngleMin>
      <JointAngleMax>215</JointAngleMax>
    </RevoluteJoint>
    <RevoluteJoint>
      <JointOffset>107.0</JointOffset>
      <JointAngle>0</JointAngle>
      <LinkLength>0</LinkLength>
      <TwistAngle>0</TwistAngle>
      <JointAngleMin>-166</JointAngleMin>
      <JointAngleMax>166</JointAngleMax>
    </RevoluteJoint>
  </Joints>
</Robot>
"""
    xml_path = os.path.join(out_dir, 'robot.xml')
    with open(xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)
    print('Generated FrankaEmikaPanda robot.xml at:', xml_path)

    # Clean up model from CoppeliaSim scene
    sim.removeModel(handle)
    print('Cleaned up CoppeliaSim scene.')

if __name__ == '__main__':
    main()
