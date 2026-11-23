import React from 'react';
import { Still } from 'remotion';
import { RobotDrawnApprovalSheet } from './RobotDrawn';
import { VIDEO } from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <Still
      id="RobotDrawnApprovalStill"
      component={RobotDrawnApprovalSheet}
      width={VIDEO.WIDTH}
      height={VIDEO.HEIGHT}
    />
  );
};
