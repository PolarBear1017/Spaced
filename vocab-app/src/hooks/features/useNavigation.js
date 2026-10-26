import { useEffect, useState } from 'react';

const useNavigation = () => {
  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(window.location.search).get('review') === 'daily' ? 'review' : 'search');
  const [returnFolderId, setReturnFolderId] = useState(null);

  useEffect(() => {
    // Consume the deep link so a later reload follows normal navigation.
    const url = new URL(window.location.href);
    if (url.searchParams.get('review') === 'daily') {
      url.searchParams.delete('review');
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  return {
    state: { activeTab, returnFolderId },
    actions: { setActiveTab, setReturnFolderId }
  };
};

export default useNavigation;
