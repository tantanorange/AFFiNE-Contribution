import { pushNotificationAtom } from '@affine/component/notification-center';
import { useAsyncCallback } from '@affine/core/hooks/affine-async-hooks';
import { affine } from '@affine/electron-api';
import { useAFFiNEI18N } from '@affine/i18n/hooks';
import { CLOUD_WORKSPACE_CHANGED_BROADCAST_CHANNEL_KEY } from '@affine/workspace';
import { useAtom, useSetAtom } from 'jotai';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { SessionProvider, useSession } from 'next-auth/react';
import {
  type PropsWithChildren,
  startTransition,
  useEffect,
  useRef,
} from 'react';

import { sessionAtom } from '../atoms/cloud-user';
import { useOnceSignedInEvents } from '../atoms/event';

const SessionDefence = (props: PropsWithChildren) => {
  const session = useSession();
  const prevSession = useRef<ReturnType<typeof useSession>>();
  const [sessionInAtom, setSession] = useAtom(sessionAtom);
  const pushNotification = useSetAtom(pushNotificationAtom);
  const onceSignedInEvents = useOnceSignedInEvents();
  const t = useAFFiNEI18N();

  const refreshAfterSignedInEvents = useAsyncCallback(async () => {
    await onceSignedInEvents();
    new BroadcastChannel(
      CLOUD_WORKSPACE_CHANGED_BROADCAST_CHANNEL_KEY
    ).postMessage(1);
  }, [onceSignedInEvents]);

  useEffect(() => {
    if (sessionInAtom !== session && session.status === 'authenticated') {
      setSession(session);
    }

    if (prevSession.current !== session && session.status !== 'loading') {
      // unauthenticated -> authenticated
      if (
        prevSession.current?.status === 'unauthenticated' &&
        session.status === 'authenticated'
      ) {
        startTransition(() => refreshAfterSignedInEvents());
        pushNotification({
          title: t['com.affine.auth.has.signed'](),
          message: t['com.affine.auth.has.signed.message'](),
          type: 'success',
        });

        if (environment.isDesktop) {
          affine?.ipcRenderer.send('affine:login');
        }
      }
      prevSession.current = session;
    }
  }, [
    session,
    sessionInAtom,
    prevSession,
    setSession,
    pushNotification,
    refreshAfterSignedInEvents,
    t,
  ]);
  return props.children;
};

export const CloudSessionProvider = ({ children }: PropsWithChildren) => {
  return (
    <SessionProvider refetchOnWindowFocus>
      <SessionDefence>{children}</SessionDefence>
    </SessionProvider>
  );
};
