#!/usr/bin/env python3
"""
Threaded static file server for this workspace, exposing the Snake game
at the path prefix /snake.

Usage:
  python3 serve.py --port 8000
  python3 serve.py --host 0.0.0.0 --port 8080  # serve on LAN

Notes:
- Requests to /snake will be redirected to /snake/ by the handler so that
  relative assets (style.css, main.js) load correctly.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import os
import sys
from html import escape
import io
from urllib.parse import quote, urlsplit, unquote


def make_handler(root_dir: str):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=root_dir, **kwargs)

        def end_headers(self):
            # Avoid stale assets during development
            self.send_header('Cache-Control', 'no-store, max-age=0')
            super().end_headers()

        def log_message(self, fmt: str, *args):
            sys.stderr.write("%s - - [%s] %s\n" % (
                self.address_string(), self.log_date_time_string(), fmt % args))

        def send_head(self):
            # Block access to any path that enters a '.git' directory
            path_only = urlsplit(self.path).path
            segments = [seg for seg in unquote(path_only).split('/') if seg and seg != '.']
            if '.git' in segments or '__pycache__' in segments:
                self.send_error(403, "Forbidden")
                return None
            return super().send_head()

        def list_directory(self, path):
            # Based on CPython's SimpleHTTPRequestHandler, with filtering,
            # and returning a file-like stream (BytesIO) as expected.
            try:
                names = os.listdir(path)
            except OSError:
                self.send_error(404, "No permission to list directory")
                return None

            # Filter out sensitive/unwanted entries
            hidden = {'.git', '.gitignore', 'README.md', 'serve.py', '__pycache__'}
            names = [n for n in names if n not in hidden]
            names.sort(key=lambda a: a.lower())

            displaypath = escape(self.path, quote=False)
            r = []
            r.append('<!DOCTYPE html>\n')
            r.append('<html>\n<head>\n')
            r.append(f"<meta charset='utf-8'><title>Directory listing for {displaypath}</title>\n")
            r.append('</head>\n<body>\n')
            r.append(f"<h2>Directory listing for {displaypath}</h2>\n")
            r.append('<hr>\n<ul>\n')
            for name in names:
                fullname = os.path.join(path, name)
                displayname = linkname = name
                # Append '/' for directories or '@' for symlinks
                if os.path.isdir(fullname):
                    displayname = name + '/'
                    linkname = name + '/'
                if os.path.islink(fullname):
                    displayname = displayname + '@'
                r.append(f"<li><a href='{quote(linkname)}'>{escape(displayname, quote=False)}</a></li>\n")
            r.append('</ul>\n<hr>\n</body>\n</html>\n')
            encoded = ''.join(r).encode('utf-8', 'surrogateescape')

            f = io.BytesIO()
            f.write(encoded)
            f.seek(0)
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            return f

    return Handler


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description='Serve this workspace over HTTP')
    parser.add_argument('--host', default='127.0.0.1', help='Host/IP to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8000, help='Port to bind (default: 8000)')
    parser.add_argument('--root', default=script_dir, help='Root directory to serve (default: this folder)')
    args = parser.parse_args()

    snake_path = os.path.join(args.root, 'snake')
    if not os.path.isdir(snake_path):
        print(f"Warning: '{snake_path}' does not exist. Ensure the 'snake' folder is under the root.")

    handler = make_handler(args.root)
    server = ThreadingHTTPServer((args.host, args.port), handler)

    rel = os.path.relpath(args.root, os.getcwd())
    path_display = args.root if rel.startswith('..') else rel
    print(f"Serving '{path_display}' at http://{args.host}:{args.port}")
    if os.path.isdir(snake_path):
        print(f"Snake game: http://{args.host}:{args.port}/snake/")
    ttt_path = os.path.join(args.root, 'tictactoe')
    if os.path.isdir(ttt_path):
        print(f"Tic‑Tac‑Toe: http://{args.host}:{args.port}/tictactoe/")
    br_path = os.path.join(args.root, 'breakout')
    if os.path.isdir(br_path):
        print(f"Breakout: http://{args.host}:{args.port}/breakout/")
    pong_path = os.path.join(args.root, 'pong')
    if os.path.isdir(pong_path):
        print(f"Pong: http://{args.host}:{args.port}/pong/")
    tetris_path = os.path.join(args.root, 'tetris')
    if os.path.isdir(tetris_path):
        print(f"Tetris: http://{args.host}:{args.port}/tetris/")
    ms_path = os.path.join(args.root, 'minesweeper')
    if os.path.isdir(ms_path):
        print(f"Minesweeper: http://{args.host}:{args.port}/minesweeper/")
    dino_path = os.path.join(args.root, 'dino')
    if os.path.isdir(dino_path):
        print(f"Dino Run: http://{args.host}:{args.port}/dino/")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
