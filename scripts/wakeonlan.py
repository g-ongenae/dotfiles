#!/usr/bin/python3
"""Enable magic-packet wake on supported physical Ethernet adapters."""
import os
from pathlib import Path
import re
import subprocess


def configure(sysfs=Path('/sys/class/net')):
    enabled = 0
    for interface in sorted(sysfs.iterdir()):
        if (not (interface / 'device').exists()
                or (interface / 'wireless').exists()
                or (interface / 'type').read_text().strip() != '1'):
            continue
        result = subprocess.run(['/usr/sbin/ethtool', interface.name],
                                env=dict(os.environ, LC_ALL='C'),
                                text=True, capture_output=True)
        support = re.search(r'Supports Wake-on:\s*([a-z]+)', result.stdout)
        if result.returncode or not support or 'g' not in support[1]:
            print(f'Skip {interface.name}: magic-packet wake is not supported or could not be queried')
            continue
        subprocess.run(['/usr/sbin/ethtool', '-s', interface.name, 'wol', 'g'], check=True)
        print(f'Enabled magic-packet wake on {interface.name}')
        enabled += 1
    if not enabled:
        print('No supported Ethernet adapters found; check hardware/firmware Wake-on-LAN support')


if __name__ == '__main__':
    configure()
