"""Test adapter selection without changing the host network."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'wakeonlan', Path(__file__).resolve().parent.parent / 'scripts/wakeonlan.py')
wakeonlan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wakeonlan)


class WakeOnLanTests(unittest.TestCase):
    def test_only_supported_physical_ethernet_is_enabled(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('eno1', 'eno2', 'wlan0', 'veth0', 'lo'):
                interface = root / name
                interface.mkdir()
                (interface / 'type').write_text('772' if name == 'lo' else '1')
                if name in ('eno1', 'eno2', 'wlan0'):
                    (interface / 'device').mkdir()
                if name == 'wlan0':
                    (interface / 'wireless').mkdir()

            def run(argv, **kwargs):
                return subprocess.CompletedProcess(argv, 0, 'Supports Wake-on: ' +
                                                   ('pumbg' if argv[-1] == 'eno1' else 'd'))

            with patch.object(wakeonlan.subprocess, 'run', side_effect=run) as calls, \
                    contextlib.redirect_stdout(io.StringIO()):
                wakeonlan.configure(root)
            self.assertEqual([call.args[0] for call in calls.call_args_list], [
                ['/usr/sbin/ethtool', 'eno1'],
                ['/usr/sbin/ethtool', '-s', 'eno1', 'wol', 'g'],
                ['/usr/sbin/ethtool', 'eno2'],
            ])

    def test_setting_failure_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            interface = Path(directory) / 'eno1'
            (interface / 'device').mkdir(parents=True)
            (interface / 'type').write_text('1')
            with patch.object(wakeonlan.subprocess, 'run', side_effect=[
                subprocess.CompletedProcess([], 0, 'Supports Wake-on: g'),
                subprocess.CalledProcessError(1, 'ethtool'),
            ]), self.assertRaises(subprocess.CalledProcessError):
                wakeonlan.configure(Path(directory))
