#!/bin/bash
ssh root@hmain journalctl -u reaction-memes.service -o cat > data/logs.txt