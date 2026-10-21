"""Checksum-pinned public tools; isolated loopback-only synthetic DynamoDB test."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import os
import signal
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

if os.name != 'posix' or os.getuid() != 0 or os.environ.get('ALLIANCE_DYNAMO_TEST_CONFIRM') != 'synthetic_account_dynamodb':
    raise SystemExit('Confirmed disposable Linux fixture required')
root = Path(__file__).resolve().parents[1]
node = Path(os.environ.get('ALLIANCE_NODE_BINARY', '/usr/bin/node')).resolve(strict=True)
if not node.is_file() or (node != Path('/usr/bin/node') and not str(node).startswith('/opt/hostedtoolcache/node/')):
    raise SystemExit('Unexpected test Node executable')
tools = [
    ('dynamodb.tar.gz', 'https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz', '7a94eb65f81aee270738751a4e5e3e6a7ad02a5d25194f55b83e08ec2ba6342b', 'dynamodb-local.tar.gz'),
    ('corretto.tar.gz', 'https://corretto.aws/downloads/resources/17.0.20.12.1/amazon-corretto-17.0.20.12.1-linux-x64.tar.gz', 'b852a8bc8890149c71141e784cde160d7ecb09bfa82b71209179b25902a0ebe3', 'corretto-17.tar.gz'),
]
scratch = Path(tempfile.mkdtemp(prefix='alliance-dynamo-')).resolve()
try:
    def prepare(tool):
        name, url, expected, cache_name = tool
        path = scratch / name
        cache = os.environ.get('ALLIANCE_DYNAMO_TOOL_CACHE')
        if cache:
            cached = Path(cache).resolve(strict=True) / cache_name
            if not cached.is_file() or cached.is_symlink():
                raise RuntimeError('Wrong cached tool')
            shutil.copyfile(cached, path)
        else:
            size = 0
            with urllib.request.urlopen(url, timeout=45) as response, path.open('xb') as out:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > 300 * 1024 * 1024:
                        raise RuntimeError('Tool download too large')
                    out.write(chunk)
        with path.open('rb') as verified:
            actual = hashlib.file_digest(verified, 'sha256').hexdigest()
        if actual != expected:
            raise RuntimeError('Official local tool checksum changed; no execution')
        target = scratch / name.split('.')[0]
        target.mkdir(mode=0o700)
        with tarfile.open(path) as archive:
            if sum(m.size for m in archive.getmembers()) > 1024 * 1024 * 1024:
                raise RuntimeError('Tool expansion too large')
            archive.extractall(target, filter='data')
        return target
    with ThreadPoolExecutor(max_workers=2) as pool:
        dynamodb, jdk = list(pool.map(prepare, tools))
    java_paths = list(jdk.glob('*/bin/java'))
    if len(java_paths) != 1:
        raise RuntimeError('Ambiguous Java executable')
    java = java_paths[0].resolve(strict=True)
    jar = (dynamodb / 'DynamoDBLocal.jar').resolve(strict=True)
    if not java.is_relative_to(scratch) or not jar.is_relative_to(scratch):
        raise RuntimeError('Wrong extracted paths')
    version = subprocess.run(['unshare', '--net', str(java), f'-Djava.library.path={dynamodb}/DynamoDBLocal_lib', '-jar', str(jar), '-version'], cwd=scratch, env={'PATH': '/usr/bin:/bin:/usr/sbin:/sbin'}, text=True, capture_output=True, check=True, timeout=10).stdout.strip()
    if version != '3.3.2':
        raise RuntimeError('Unexpected DynamoDB Local version')
    print('PASS official SHA-256-pinned DynamoDB Local3.3.2 and Corretto17 tools verified; no installation', flush=True)
    request = json.dumps(dict(scratch=str(scratch), java=str(java), jar=str(jar)))
    child = subprocess.Popen(['unshare', '--net', 'sh', '-c', 'ip link set lo up; exec "$1" "$2"', 'fixture', str(node), str(root / 'lib/alliance-avatar-server/account-dynamodb.native.mjs')], cwd=scratch, stdin=subprocess.PIPE, text=True, start_new_session=True,
                             env={'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'ALLIANCE_DYNAMO_TEST_CONFIRM': 'synthetic_account_dynamodb'})
    try:
        child.communicate(input=request, timeout=100)
        if child.returncode:
            raise subprocess.CalledProcessError(child.returncode, child.args)
    finally:
        # The group is created by this exact child; includes its Java process.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=5)
finally:
    if scratch.parent != Path('/tmp') or not scratch.name.startswith('alliance-dynamo-') or scratch.resolve() != scratch or scratch.is_symlink():
        raise RuntimeError('Wrong fixture cleanup target')
    shutil.rmtree(scratch)
print('PASS exact disposable emulator database, public-tool extraction and owned scratch removed')
