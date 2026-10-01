#!/usr/bin/env python3
"""Replay branch SRC as DST, swapping in English messages from scripts/public-messages/<sha>.txt.

Rewrites raw commit objects (only parent lines + message change), so unmapped commits keep their
SHAs and the result is deterministic — later publishes still fast-forward. Works on a dirty worktree.
Usage: public_history.py SRC DST
"""
import pathlib, subprocess, sys

MSGDIR = pathlib.Path(__file__).resolve().parent / "public-messages"


def git(*args, data=None):
    return subprocess.run(["git", *args], input=data, capture_output=True, check=True).stdout


src, dst = sys.argv[1:3]
new = {}
for sha in git("rev-list", "--reverse", "--topo-order", src).decode().split():
    raw = git("cat-file", "commit", sha)
    head, msg = raw.split(b"\n\n", 1)
    lines = [
        b"parent " + new[l[7:].decode()].encode() if l.startswith(b"parent ") else l
        for l in head.split(b"\n")
    ]
    f = MSGDIR / f"{sha}.txt"
    if f.exists():
        msg = f.read_bytes()
    obj = b"\n".join(lines) + b"\n\n" + msg
    new[sha] = git("hash-object", "-t", "commit", "-w", "--stdin", data=obj).decode().strip()
tip = new[git("rev-parse", src).decode().strip()]
git("branch", "-f", dst, tip)
print(tip)
