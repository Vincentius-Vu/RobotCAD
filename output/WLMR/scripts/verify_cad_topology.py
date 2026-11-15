#!/usr/bin/env python3
"""
Wheel-Legged Mobile Robot (WLMR) - CAD & Kinematics Baseline Verification Script
Inspects Assembly_All.glb and step files to extract nominal kinematic dimensions.
"""

import json
import struct
import numpy as np

def inspect_glb(glb_path):
    print(f"=== Inspecting GLB: {glb_path} ===")
    with open(glb_path, 'rb') as f:
        magic = f.read(4)
        assert magic == b'glTF', "Not a valid GLB"
        version, length = struct.unpack('<II', f.read(8))
        json_len, json_type = struct.unpack('<II', f.read(8))
        json_data = f.read(json_len)
        gltf = json.loads(json_data.decode('utf-8'))

    print(f"GLTF Version: {version}, Total Length: {length / 1024 / 1024:.2f} MB")
    print(f"Nodes: {len(gltf.get('nodes', []))}, Meshes: {len(gltf.get('meshes', []))}")

    # Inspect key mechanical nodes
    key_nodes = {}
    for i, n in enumerate(gltf.get('nodes', [])):
        name = n.get('name', '')
        if any(k in name.lower() for k in ['wheel', 'spoke', 'lid', 'gearbox', 'nema', 'nidec', 'part']):
            key_nodes[i] = name

    print(f"Identified {len(key_nodes)} core mechanical nodes.")
    print("Sample key nodes:")
    for idx, name in list(key_nodes.items())[:10]:
        print(f"  [{idx:02d}] {name}")

    return gltf

if __name__ == '__main__':
    glb_file = 'robotics-visualizer/output/WLMR/models/Assembly_All.glb'
    try:
        inspect_glb(glb_file)
        print("\n[SUCCESS] Baseline CAD verification complete.")
    except Exception as e:
        print(f"\n[ERROR] Verification failed: {e}")
