import React from 'react';
import CtaButton from '@/components/shared/CtaButton';

const ExploreQuestsButton: React.FC = () => {
  return (
    <CtaButton variant="primary" block data-intro="explore-quests">
      Explore Quests
    </CtaButton>
  );
};

export default ExploreQuestsButton;
