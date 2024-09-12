#boot
import gc, secret
import network
from machine import Pin
from time import sleep

gc.collect()

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

if not wlan.isconnected():
    print("connection to network")
    wlan.connect(secret.ssid, secret.password)
    while not wlan.isconnected():
        pass
    print("network.config: ",wlan.ifconfig())

while station.isconnected() == False:
  pass

print('Connection successful')
print(station.ifconfig())
