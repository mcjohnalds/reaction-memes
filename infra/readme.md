# Readme

- Hetzner
  - VM
    - Debian
    - Users
      - `reaction-memes`
      - `cloudflared`
      - Password login disabled
    - Installed software
      - cloudflared
      - node
      - npm
    - Files
      `~reaction-memes/reaction-memes`
        - Git repo
      `/etc/cloudflared/env`
        - Cloudflare tunnel token
        - `TUNNEL_TOKEN=eyJ...`
      `/etc/systemd/system/reaction-memes.service`
        - Runs reaction-memes service
        - See `reaction-memes.service`
      `/etc/systemd/system/cloudflared.service`
        - Runs cloudflared service
        - See `cloudflared.service`
      `/etc/ssh/sshd_service`
        - Password auth disabled
      `/etc/sudoers`
        - Permits user `reaction-memes` to run `systemctl restart reaction-memes`
  - Network
    - Port 22 is the only open inbound port
- Cloudflare
  - Tunnel with a published application route that links reactionmemes.app to
    http://localhost:8080
  - DNS has a CNAME record automatically created by Cloudflare tunnel
- UptimeRobot
  - Monitor for `reactionmemes.app`