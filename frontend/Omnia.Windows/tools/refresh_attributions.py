"""Capture declared authors and verbatim notices from the resolved dependency graph.

Run after app/test restore. Optional --python-packages points to the schema validator
environment. License fallback URLs come from package metadata or official projects.
This developer tool does not run inside the app.
"""
import argparse
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
LICENSES = ROOT / 'licenses'
ATTRIBUTION = ROOT / 'attribution'
LICENSES.mkdir(exist_ok=True)
ATTRIBUTION.mkdir(exist_ok=True)
sources = {}
entries = []
download_cache = {}


def preserve(data, label, source):
    digest = hashlib.sha256(data).hexdigest()
    suffix = Path(label).suffix.lower() or '.txt'
    # Content-addressed names deduplicate identical notices without rewriting them.
    name = digest[:16] + suffix
    (LICENSES / name).write_bytes(data)
    path = 'licenses/' + name
    sources.setdefault(path, {'sha256': digest, 'origins': []})['origins'].append(source)
    return path


def download(url):
    if url not in download_cache:
        with urllib.request.urlopen(url, timeout=30) as response:
            download_cache[url] = (response.read(), response.url)
    return download_cache[url]


def remote_notice(url, label):
    data, actual = download(url)
    return preserve(data, label, actual)


def add_source(component_id, display_name, authors, version, source_file, source_url, license_name):
    notice = preserve(source_file.read_bytes(), source_file.name, source_url)
    entries.append({'component_id': component_id, 'display_name': display_name,
        'version': version, 'authors': authors, 'scope': 'Embedded source',
        'copyright': '', 'license': license_name, 'license_files': [notice], 'source': source_url})


def nuget_records():
    packages = {}
    for scope, relative in [('App dependency', 'src/Omnia.Windows/obj/project.assets.json'),
                            ('Test dependency', 'tests/Omnia.Windows.Tests/obj/project.assets.json')]:
        assets = json.loads((ROOT / relative).read_text(encoding='utf-8'))
        for identity, library in assets['libraries'].items():
            if library['type'] != 'package':
                continue
            directory = next((Path(folder) / library['path'] for folder in assets['packageFolders']
                              if (Path(folder) / library['path']).exists()), None)
            if directory is None:
                raise RuntimeError(f'Unrestored package: {identity}')
            packages.setdefault(identity, {'directory': directory, 'scope': scope})
    # Self-contained framework packs are not listed as normal project libraries.
    app_assets = json.loads((ROOT / 'src/Omnia.Windows/obj/project.assets.json').read_text(encoding='utf-8'))
    framework = app_assets['project']['frameworks']
    runtime_version = next(iter(framework.values()))['downloadDependencies']
    for dependency in runtime_version:
        if dependency['name'].lower() == 'microsoft.netcore.app.runtime.win-x64':
            version = dependency['version'].strip('[]').split(',')[0]
            directory = next(Path(folder) / dependency['name'].lower() / version for folder in app_assets['packageFolders']
                             if (Path(folder) / dependency['name'].lower() / version).exists())
            packages[dependency['name'] + '/' + version] = {'directory': directory, 'scope': 'Bundled .NET runtime'}
    for identity, package in sorted(packages.items()):
        directory = package['directory']
        nuspec = next(directory.glob('*.nuspec'))
        document = ET.parse(nuspec).getroot()
        def field(name):
            node = document.find('.//{*}' + name)
            return node.text if node is not None else None
        license_node = document.find('.//{*}license')
        repository = document.find('.//{*}repository')
        origin = f'https://www.nuget.org/packages/{identity}'
        metadata_path = preserve(nuspec.read_bytes(), nuspec.name + '.xml', origin + ' (package metadata)')
        notices = []
        for file in sorted(directory.rglob('*')):
            if file.is_file() and file.suffix.lower() in ('', '.txt', '.md', '.rtf') and any(
                    token in file.name.lower() for token in ('license', 'notice', 'copying', 'copyright', 'authors')):
                notices.append(preserve(file.read_bytes(), file.name, origin + '#' + file.relative_to(directory).as_posix()))
        has_license = any(any(token in Path(sources[path]['origins'][-1]).name.lower() for token in ('license', 'copying')) for path in notices)
        if not has_license:
            if identity.lower().startswith('microsoft.windows.sdk.buildtools/'):
                notices.append(remote_notice(field('licenseUrl'), 'Windows-SDK-license.rtf'))
            elif identity.lower().startswith('xunit'):
                if identity.lower().startswith('xunit.abstractions/'):
                    # This legacy package points to xunit/master/license.txt, now moved.
                    # Preserve its declared metadata plus the pinned xUnit v2 family notice.
                    url = 'https://raw.githubusercontent.com/xunit/xunit/9712244020d385955d33136b3fe3e87de43539cd/license.txt'
                elif repository is not None and repository.get('commit'):
                    url = repository.get('url', '').removesuffix('.git').replace('https://github.com/', 'https://raw.githubusercontent.com/')
                    url += '/' + repository.get('commit') + '/license.txt'
                else:
                    url = field('licenseUrl')
                for filename in ('license.txt', 'LICENSE', 'LICENSE.txt', 'License.txt'):
                    candidate_url = url.rsplit('/', 1)[0] + '/' + filename
                    try:
                        notices.append(remote_notice(candidate_url, 'xunit-license.txt'))
                        break
                    except urllib.error.HTTPError as error:
                        if error.code != 404:
                            raise
                else:
                    raise RuntimeError(f'Missing license at pinned xUnit source: {url}')
                notices.append(remote_notice('https://www.apache.org/licenses/LICENSE-2.0.txt', 'Apache-2.0.txt'))
            elif (field('license') or '') == 'MIT' and identity.startswith('Microsoft.'):
                notices.append(remote_notice('https://raw.githubusercontent.com/microsoft/vstest/v17.14.1/LICENSE', 'vstest-LICENSE.txt'))
            else:
                raise RuntimeError(f'Unresolved license text: {identity}')
        if not field('authors'):
            raise RuntimeError(f'Missing declared authors: {identity}')
        scope = 'Build dependency' if '.SDK.BuildTools' in identity else package['scope']
        entries.append({'component_id': identity, 'display_name': identity.split('/')[0], 'version': identity.split('/')[1],
            'authors': field('authors'), 'copyright': field('copyright') or '', 'scope': scope,
            'license': field('license') or 'Publisher license', 'license_files': sorted(set(notices)),
            'metadata_file': metadata_path, 'source': origin,
            'repository': repository.attrib if repository is not None else {}})


def python_records(package_path):
    kwargs = {'path': [package_path]} if package_path else {}
    wanted = {'jsonschema', 'jsonschema-specifications', 'attrs', 'referencing', 'rpds-py', 'typing-extensions'}
    for dist in metadata.distributions(**kwargs):
        name = dist.metadata['Name']
        if name.lower().replace('_', '-') not in wanted:
            continue
        authors = dist.metadata.get('Author') or dist.metadata.get('Author-email')
        if not authors:
            raise RuntimeError(f'Missing Python author metadata: {name}')
        notices = []
        for file in dist.files:
            if any(part.lower() in ('licenses', 'license', 'copying', 'notice') or 'license' in part.lower() for part in file.parts):
                path = Path(dist.locate_file(file))
                if path.is_file():
                    notices.append(preserve(path.read_bytes(), path.name, f'https://pypi.org/project/{name}/{dist.version}/#{file}'))
        if not notices:
            raise RuntimeError(f'Missing Python license: {name}')
        entries.append({'component_id': 'pypi:' + name, 'display_name': name, 'version': dist.version,
            'authors': authors, 'copyright': '', 'scope': 'Independent schema validation',
            'license': dist.metadata.get('License-Expression') or dist.metadata.get('License') or 'See notices',
            'license_files': sorted(set(notices)), 'source': f'https://pypi.org/project/{name}/{dist.version}/'})
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if not python_license.exists():
        raise RuntimeError('Python interpreter license is missing')
    entries.append({'component_id': 'python', 'display_name': 'Python interpreter', 'version': sys.version.split()[0],
        'authors': 'Python Software Foundation and the copyright holders named in the complete license',
        'scope': 'Independent schema validation', 'copyright': '', 'license': 'PSF and included historical notices',
        'license_files': [preserve(python_license.read_bytes(), python_license.name, 'Python interpreter distribution/LICENSE.txt')],
        'source': 'https://www.python.org/'})


def ci_records():
    workflow = (REPO / '.github/workflows/windows-omnia.yml').read_text(encoding='utf-8')
    for component, version in sorted(set(re.findall(r'uses:\s+(actions/[\w-]+)@([\w.-]+)', workflow))):
        ref = subprocess.check_output(['git','ls-remote',f'https://github.com/{component}.git',f'refs/tags/{version}'], text=True).split()[0]
        notices = [remote_notice(f'https://raw.githubusercontent.com/{component}/{ref}/LICENSE', 'LICENSE.txt')]
        entries.append({'component_id':component, 'display_name':component, 'version':version + ' @ ' + ref,
            'authors':'GitHub, Inc. and contributors named in the upstream license', 'copyright':'',
            'scope':'CI workflow; not distributed in the app', 'license':'MIT', 'license_files':notices,
            'source':f'https://github.com/{component}/tree/{ref}'})


def toolchain_record():
    dotnet = Path(subprocess.check_output(['where.exe', 'dotnet'], text=True).splitlines()[0]).parent
    version = subprocess.check_output(['dotnet', '--version'], cwd=ROOT, text=True).strip()
    notices = [preserve((dotnet / name).read_bytes(), name, 'Installed .NET toolchain/' + name)
               for name in ('LICENSE.txt', 'ThirdPartyNotices.txt')]
    entries.append({'component_id': 'dotnet-sdk', 'display_name': '.NET build toolchain', 'version': version,
        'authors': 'Microsoft and the contributors named in the original .NET notices', 'copyright': '',
        'scope': 'Build toolchain; SDK not distributed in the app', 'license': 'MIT and included third-party terms',
        'license_files': notices, 'source': 'https://github.com/dotnet/sdk'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--python-packages')
    args = parser.parse_args()
    add_source('omnia-vault', 'Omnia', 'serg.alexv (copyright holder)', 'Windows evolution v1',
        REPO / 'LICENSE', 'https://github.com/timelabs-npo/omnia-vault', 'MIT')
    add_source('AdventDevInc/kudu', 'Maintenance definitions', 'Advent Development Inc (copyright holder)',
        '92dbc52336ad9c9eb2968a180d22c72670de3b45', REPO / 'third_party/kudu/LICENSE',
        'https://github.com/AdventDevInc/kudu/tree/92dbc52336ad9c9eb2968a180d22c72670de3b45', 'MIT')
    add_source('omnia-playbook', 'Omnia maintenance semantics', 'timelabs non-profit corp (copyright holder)',
        '35c21e2a56310870090ef927f8f7bfadfcc761aa', ROOT / 'fixtures/playbook/LICENSE',
        'https://github.com/timelabs-npo/omnia-playbook/tree/35c21e2a56310870090ef927f8f7bfadfcc761aa', 'BSD-3-Clause')
    nuget_records()
    python_records(args.python_packages)
    toolchain_record()
    ci_records()
    result = {'schema_version':'omnia-attribution/v1', 'basis':'Declared package authors, original copyright holders, and verbatim bundled notices. Contributor identities are not inferred.',
              'components':entries, 'files':sources}
    (ATTRIBUTION / 'components.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')
    lines = ['# Component authors and notices', '', result['basis'], '',
             'Product branding is Omnia. Upstream source identities remain explicit in this record; the app uses a neutral maintenance-component label.', '',
             'Every notice referenced below is preserved byte-for-byte under `licenses/`, including embedded third-party copyright blocks. Package author fields are not an assertion of sole authorship.', '',
             '| Component | Version | Declared authors / copyright holders | Use |', '|---|---|---|---|']
    for entry in entries:
        clean = lambda value: str(value).replace('|','\\|').replace('\n',' ')
        lines.append('| ' + ' | '.join(clean(entry[key]) for key in ('component_id','version','authors','scope')) + ' |')
    lines += ['', '## Original notices', '']
    for entry in entries:
        lines += [f"### {entry['component_id']} {entry['version']}", '', entry['authors'], entry['copyright'], '',
                  'Source: ' + entry['source'], '']
        lines += [f'- [Original notice {index + 1}]({path})' for index,path in enumerate(entry['license_files'])]
        lines.append('')
    (ROOT / 'THIRD_PARTY_NOTICES.md').write_text('\n'.join(lines)+'\n', encoding='utf-8', newline='\n')
    print(f'Captured {len(entries)} components, {len(sources)} exact notice/metadata files')


if __name__ == '__main__':
    main()
