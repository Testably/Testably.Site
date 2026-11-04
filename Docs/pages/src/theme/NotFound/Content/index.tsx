/**
 * Wrapped NotFound content. The Awaiten docs moved to their own site; GitHub Pages cannot redirect server-side, so the
 * old `/Awaiten/...` links land here and are forwarded to the same path on the new site.
 */
import React, {type ReactNode, useEffect} from 'react';
import {useLocation} from '@docusaurus/router';
import Content from '@theme-original/NotFound/Content';
import type ContentType from '@theme/NotFound/Content';
import type {WrapperProps} from '@docusaurus/types';

const AWAITEN_SITE = 'https://awaiten-dev.github.io/Awaiten';
const AWAITEN_PATTERN = /^\/awaiten(\/.*)?$/i;

export default function ContentWrapper(props: WrapperProps<typeof ContentType>): ReactNode {
  const {pathname, search, hash} = useLocation();
  const match = pathname.match(AWAITEN_PATTERN);
  const target = match ? `${AWAITEN_SITE}${match[1] ?? '/'}${search}${hash}` : null;
  useEffect(() => {
    if (target) {
      window.location.replace(target);
    }
  }, [target]);
  return <Content {...props} />;
}
