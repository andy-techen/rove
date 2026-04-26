import { createContext, useContext } from 'react';

export const ProfileRefreshContext = createContext<() => void>(() => {});
export const useProfileRefresh = () => useContext(ProfileRefreshContext);
