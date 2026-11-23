import {Composition} from "remotion";
import {Ad} from "./Ad";
import {Spike3D} from "./Spike3D";
import {AdV3} from "./AdV3";
import {AdV4} from "./AdV4";
import {AdDesk} from "./AdDesk";
import {SpikeThree} from "./SpikeThree";
import {AdBundle} from "./AdBundle";
import {AdBundleD} from "./AdBundleD";
import {AdTicket} from "./AdTicket";
import {AdMix} from "./AdMix";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Ad"
        component={Ad}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Spike3D"
        component={Spike3D}
        durationInFrames={105}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdV3"
        component={AdV3}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdV4"
        component={AdV4}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdDesk"
        component={AdDesk}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SpikeThree"
        component={SpikeThree}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdBundle"
        component={AdBundle}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdBundleD"
        component={AdBundleD}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdTicket"
        component={AdTicket}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdMix"
        component={AdMix}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
