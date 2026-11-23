import {ThreeCanvas} from "@remotion/three";
import {useVideoConfig} from "remotion";

export const SpikeThree = () => {
  const {width, height} = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} camera={{position: [0, 0, 6], fov: 50}}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 6]} intensity={1.2} />
      <mesh rotation={[0.4, 0.6, 0]} position={[0, 0, 0]}>
        <boxGeometry args={[2.4, 1.4, 0.5]} />
        <meshStandardMaterial color="#c41c83" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#e8e4f0" />
      </mesh>
    </ThreeCanvas>
  );
};
