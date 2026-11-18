"""Extract only the agreed plain recovery data files, as regular files."""
import sys
import tarfile
from pathlib import Path

archive, destination, *expected = sys.argv[1:]
with tarfile.open(archive, "r:gz") as pack:
    members = {}
    total = 0
    for item in pack:
        total += item.size
        if (not item.isfile() or item.name not in expected or item.name in members
                or total > 256 * 1024 * 1024):
            raise ValueError("Unsupported recovery archive entry")
        members[item.name] = item
    if set(members) != set(expected):
        raise ValueError("Incomplete recovery archive")
    for name, item in members.items():
        with (Path(destination) / name).open("xb") as out, pack.extractfile(item) as src:
            while chunk := src.read(1024 * 1024):
                out.write(chunk)
