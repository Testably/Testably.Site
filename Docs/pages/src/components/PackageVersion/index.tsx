/**
 * The latest version of a package from NuGet (see the `nuget-versions` plugin), linked to its NuGet page. Packages
 * without a stable release, or with `prerelease`, show the latest pre-release.
 */
import React, {type ReactElement} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import Link from '@docusaurus/Link';
import type {PackageVersions} from '@site/src/plugins/nuget-versions';

type Props = {
  package: string;
  prerelease?: boolean;
};

export default function PackageVersion({package: id, prerelease = false}: Props): ReactElement {
  const versions = usePluginData('nuget-versions') as PackageVersions;
  const found = versions[id];
  if (!found) {
    throw new Error(`Unknown package '${id}': add it to the nuget-versions plugin in docusaurus.config.ts.`);
  }
  const version = prerelease || !found.stable ? found.latest : found.stable;
  return <Link href={`https://www.nuget.org/packages/${id}/${version}`}>{version}</Link>;
}
