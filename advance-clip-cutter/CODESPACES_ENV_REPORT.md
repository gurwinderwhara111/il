# Codespaces Environment Report

Captured on 2026-04-12 UTC from this Codespace while debugging upload throughput.

## Compute

- CPU: 4 vCPU (`nproc`)
- Memory: 15 GiB total, about 10 GiB available at capture time (`free -h`)
- OS: Ubuntu 22.04 on Azure kernel `6.8.0-1044-azure`

## Storage

- Workspace volume: 32G total, 12G used, 18G free (`df -h /workspaces/il`)
- `/tmp` volume: 118G total, 3.5G used, 109G free (`df -h /tmp`)

## Local Disk Throughput

Measured inside the Codespace:

- `/tmp` write test: about 392 MB/s
- `/tmp` read test: about 1.9 GB/s

These numbers indicate local disk is not the bottleneck for browser uploads into the Codespace.

## External Network Probe

Measured from the Codespace to Cloudflare speed endpoints:

- Download probe: `10,000,000` bytes in `0.151343s` -> about `66.1 MB/s` (`~528.6 Mbps`)
- Upload probe: `5,000,000` bytes in `0.135908s` -> about `36.8 MB/s` (`~294.3 Mbps`)

These are rough point-in-time probes, not guaranteed sustained rates.

## Upload Bottleneck Notes

- The Codespace browser upload path is fronted by `nginx`.
- Large `32 MB` upload requests were rejected with `413 Request Entity Too Large`.
- That means the earlier slow upload problem was not caused by Wi-Fi or local disk speed.
- The practical bottlenecks here are request size limits plus browser-to-Codespaces latency/overhead.

## Current App Upload Tuning

The app has been tuned for this Codespace environment to favor reliability:

- Chunked upload threshold: `8 MB`
- Chunk size: `4 MB`
- Parallel chunk concurrency: `4`
- Chunk retry limit: `2`
- `413` responses are surfaced immediately as proxy-limit failures instead of being retried repeatedly
