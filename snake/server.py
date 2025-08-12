#!/usr/bin/env python3
"""
Simple static file server for the Snake game.

Usage:
  python3 server.py --port 8000
  python3 server.py --host 0.0.0.0 --port 8080  # serve on LAN
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import os
import sys


def make_handler(directory: str):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

        def end_headers(self):
            # Help avoid stale assets during development
            self.send_header('Cache-Control', 'no-store, max-age=0')
            super().end_headers()

        def log_message(self, fmt: str, *args):
            sys.stderr.write("%s - - [%s] %s\n" % (
                self.address_string(), self.log_date_time_string(), fmt % args))

    return Handler


def main():
    parser = argparse.ArgumentParser(description='Serve the Snake game over HTTP')
    parser.add_argument('--host', default='127.0.0.1', help='Host/IP to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8000, help='Port to bind (default: 8000)')
    parser.add_argument('--dir', default=os.path.dirname(os.path.abspath(__file__)), help='Directory to serve')
    args = parser.parse_args()

    handler = make_handler(args.dir)
    server = ThreadingHTTPServer((args.host, args.port), handler)

    rel = os.path.relpath(args.dir, os.getcwd())
    path_display = args.dir if rel.startswith('..') else rel
    print(f"Serving '{path_display}' at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == '__main__':
    main()

