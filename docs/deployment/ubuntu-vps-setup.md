# Ubuntu VPS Setup — Laptop Server with Cloudflare Tunnel

Self-hosted Ubuntu Server on a repurposed laptop, exposed to internet via Cloudflare Tunnel. No port forwarding or static IP required.

## Server Specs

| Item | Detail |
|------|--------|
| OS | Ubuntu Server 24.04.4 LTS (Noble) |
| Hostname | `flowgrid` |
| User | `phamty` |
| Storage | Lexar SSD 119GB (LVM) |
| Network | WiFi (`wlp2s0`), LAN (`enp3s0`) |
| Local IP | `192.168.1.5` |
| SSH | Port 22, OpenSSH |
| Domain | `flowgrid.live` |
| Tunnel | Cloudflare Tunnel `flowgrid` |
| Tunnel ID | `6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9` |

## Architecture

```
Internet → flowgrid.live → Cloudflare Edge (HTTPS/DDoS)
    → Cloudflare Tunnel (encrypted outbound)
    → cloudflared daemon on laptop
    → localhost:3000
```

## Installation Steps

### 1. Ubuntu Server Install

- Boot from USB (Rufus + Ubuntu Server 24.04 ISO)
- Install type: Ubuntu Server (minimized)
- Disk: Use entire disk (LVM, no encryption)
- SSH: OpenSSH server enabled
- No snaps selected

### 2. Post-Install Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout/login to apply group

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Install Cloudflare Tunnel
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared -y
```

### 3. Lid Switch — Keep Running When Closed

```bash
sudo sed -i 's/#HandleLidSwitch=suspend/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=suspend/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```

Verify:
```bash
cat /etc/systemd/logind.conf | grep HandleLidSwitch
# Should show: HandleLidSwitch=ignore
```

### 4. Cloudflare Tunnel Setup

#### Domain Setup
1. Add `flowgrid.live` to Cloudflare dashboard (Free plan)
2. Update nameservers at domain registrar to Cloudflare's assigned nameservers
3. Wait for domain status to become **Active**

#### Tunnel Creation
```bash
cloudflared tunnel login
# Opens URL → authorize in browser → select flowgrid.live

cloudflared tunnel create flowgrid
# Returns Tunnel ID: 6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9

cloudflared tunnel route dns flowgrid flowgrid.live
```

#### Tunnel Config

File: `/etc/cloudflared/config.yml`

```yaml
tunnel: 6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9
credentials-file: /home/phamty/.cloudflared/6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9.json

ingress:
  - hostname: flowgrid.live
    service: http://localhost:3000
  - service: http_status:404
```

#### Enable as System Service
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## Access

### SSH (from Mac, same network)
```bash
ssh phamty@192.168.1.5
```

### Remote Management
- Use Terminus app or any SSH client
- Host: `192.168.1.5`, Port: `22`, User: `phamty`

## Operations

### Check Tunnel Status
```bash
sudo systemctl status cloudflared
```

### Restart Tunnel
```bash
sudo systemctl restart cloudflared
```

### View Tunnel Logs
```bash
sudo journalctl -u cloudflared -f
```

### Server Reboot
```bash
sudo reboot
```
Docker and cloudflared auto-start on boot.

## Adding Subdomains

Edit `/etc/cloudflared/config.yml` to add more services:

```yaml
ingress:
  - hostname: flowgrid.live
    service: http://localhost:3000
  - hostname: api.flowgrid.live
    service: http://localhost:8000
  - service: http_status:404
```

Then create DNS route and restart:
```bash
cloudflared tunnel route dns flowgrid api.flowgrid.live
sudo systemctl restart cloudflared
```

## Important Notes

- Keep laptop **plugged in 24/7** — running on battery will drain and shutdown
- Lid can be closed — configured to ignore lid switch
- WiFi-based — if WiFi drops, tunnel disconnects (consider ethernet for stability)
- IP `192.168.1.5` is DHCP-assigned — may change after router restart (consider static IP via netplan)
- Domain registrar: nameservers pointed to Cloudflare
