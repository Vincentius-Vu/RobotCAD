import { RobotModel } from '../../types/robot';
import {
  CodeExportOptions,
  GeneratedCodeResult,
} from '../../types/codeExport';
import { generatePythonCode } from './pythonGenerator';
import { generateCppCode } from './cppGenerator';
import { generateMatlabCode } from './matlabGenerator';
import { generateUrdfCode } from './urdfGenerator';

export function generateRobotCode(
  robot: RobotModel,
  currentAnglesDeg: number[],
  options: CodeExportOptions
): GeneratedCodeResult {
  switch (options.target) {
    case 'python-rtb': {
      const code = generatePythonCode(robot, currentAnglesDeg, options);
      return {
        code,
        language: 'python',
        fileName: `${robot.id.toLowerCase()}_robotics.py`,
        mimeType: 'text/x-python',
        description: 'Python script utilizing Peter Corke’s Robotics Toolbox & Spatial Math',
        instructions: 'Run via `python ' + robot.id.toLowerCase() + '_robotics.py`. Requires `pip install roboticstoolbox-python spatialmath-python numpy matplotlib`.',
      };
    }
    case 'cpp-eigen': {
      const code = generateCppCode(robot, currentAnglesDeg, options);
      return {
        code,
        language: 'cpp',
        fileName: `${robot.id.toLowerCase()}_kinematics.cpp`,
        mimeType: 'text/x-c++src',
        description: 'Standard C++17 standalone kinematics & Jacobian solver (compatible with cppnb syllabus)',
        instructions: 'Compile via `g++ -O3 -std=c++17 ' + robot.id.toLowerCase() + '_kinematics.cpp -o ' + robot.id.toLowerCase() + '_kinematics` and run `./' + robot.id.toLowerCase() + '_kinematics`.',
      };
    }
    case 'matlab-rst': {
      const code = generateMatlabCode(robot, currentAnglesDeg, options);
      return {
        code,
        language: 'matlab',
        fileName: `${robot.id.toLowerCase()}_model.m`,
        mimeType: 'text/x-matlab',
        description: 'MATLAB Robotics System Toolbox rigidBodyTree & kinematics/dynamics script',
        instructions: 'Open in MATLAB R2019b+ and press Run (F5). Requires Robotics System Toolbox.',
      };
    }
    case 'ros2-urdf': {
      const code = generateUrdfCode(robot, currentAnglesDeg, options);
      return {
        code,
        language: 'xml',
        fileName: `${robot.id.toLowerCase()}.urdf`,
        mimeType: 'application/xml',
        description: 'Standard Unified Robot Description Format (URDF) XML file for ROS 2 / RViz2 / Gazebo',
        instructions: 'Check with `check_urdf ' + robot.id.toLowerCase() + '.urdf` or preview in RViz2: `ros2 launch urdf_tutorial display.launch.py model:=' + robot.id.toLowerCase() + '.urdf`.',
      };
    }
    default:
      throw new Error(`Unsupported code export target: ${options.target}`);
  }
}
