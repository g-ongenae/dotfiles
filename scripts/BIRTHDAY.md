Get your birthdate in cron format: [crontab.guru](https://crontab.guru/)

```shell
# Create a file name script.sh
echo "#\! /bin/sh\n\nsay -v Samantha \"Happy birthday to you, Guillaume\!\"" > script.sh
# Make the script executable
chmod +x ./script.sh
# Create a file listing the cron date and target
#     <cron date>     <script path>
echo "45 12 16 1 *    ${PWD}/script.sh" > cronjobs.txt
# Add the list to cronjob
crontab cronjobs.txt
```