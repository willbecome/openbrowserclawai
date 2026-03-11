// ---------------------------------------------------------------------------
// src/hooks/useGitHubUpdate.ts — OTA update check logic
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';

const REPO = 'willbecome/openbrowserclawai';
const BRANCH = 'multi-model-vietnamese-ui-5113074538198622497';
const STORAGE_KEY = 'lastCommitSHA';

export function useGitHubUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestCommit, setLatestCommit] = useState('');

  const checkUpdate = async () => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) return;

      const data = await res.json();
      const currentSHA = data.sha;

      const lastSHA = localStorage.getItem(STORAGE_KEY);

      // If we don't have a stored SHA, store current and return (initial visit)
      if (!lastSHA) {
        localStorage.setItem(STORAGE_KEY, currentSHA);
        return;
      }

      if (currentSHA && lastSHA !== currentSHA) {
        setHasUpdate(true);
        setLatestCommit(currentSHA);
      }
    } catch (err) {
      console.log('Không kiểm tra được cập nhật (ngoại tuyến hoặc vượt giới hạn API)');
    }
  };

  useEffect(() => {
    checkUpdate();
    // Check every 30 minutes
    const interval = setInterval(checkUpdate, 1000 * 60 * 30);
    return () => clearInterval(interval);
  }, []);

  const updateNow = () => {
    // Reload page to let Service Worker apply updates
    window.location.reload();
    // Also open the branch page so user can see what's new or pull manually
    window.open(`https://github.com/${REPO}/tree/${BRANCH}`, '_blank');
  };

  return { hasUpdate, updateNow, latestCommit, checkUpdate };
}
