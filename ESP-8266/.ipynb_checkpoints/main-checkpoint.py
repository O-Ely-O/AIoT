# Main.py
import time
from umqtt.simple import MQTTClient
from machine import Pin
from time import sleep_ms, sleep
import ubinascii
import machine, random
import ssl
import micropython
import secret
#import config

mqtt_server = 'mqtt.flespi.io'
user = secret.flespi_token

#Generate Client-ID
client_id = ubinascii.hexlify(machine.unique_id())

topic_sub = [b'relay', b'temperature', b'switch'] #Subscribe to multiple topics
topic_pub = b'temperature'

last_message = 0
message_interval = 30
counter = 0
#led = Pin(14, Pin.OUT)
relay = Pin(5, Pin.OUT)
push_btn = Pin(13, Pin.IN)
btn_state = False

def debounce(state):
    stateNow = push_btn.value()
    if state != stateNow:
        sleep_ms(10)
        stateNow = push_btn.value()
    return stateNow

def sub_cb(topic, msg):
  print((topic, msg))
  if topic == b'relay' and msg == b'OFF:swLR':
      relay.value(1)
  elif topic == b'relay' and msg == b'ON:swLR':
      relay.value(0) 


def connect_and_subscribe():
    global client_id, mqtt_server, topic_sub
    #client = MQTTClient.ping()   
    client = MQTTClient(client_id, server=mqtt_server, port=1883, user=user, password='')
#MQTTClient(client_id, mqtt_server, port=1883)
    client.set_callback(sub_cb)
    client.connect()
    for topic in topic_sub:
        client.subscribe(topic)
        print('Connected to %s MQTT broker, subscribed to %s topic' % (mqtt_server, topic_sub))
    return client

def get_temp_reading():
    return random.randint(20, 50)

def restart_and_reconnect():
  print('Failed to connect to MQTT broker. Reconnecting...')
  time.sleep(10)
  machine.reset()

try:
    client = connect_and_subscribe()
except OSError as e:
    restart_and_reconnect()

while True:
  try:
    client.check_msg()
    if (time.time() - last_message) > message_interval:
        #msg = b'Hello #%d' % counter
        random_temp = get_temp_reading()  
        client.publish(topic_pub, str(random_temp).encode() +':'+ client_id)
        last_message = time.time()
        #counter += 1
    if debounce(btn_state) == True and btn_state == False:
        if relay.value() == 1:
            client.publish(b'relay', b'ON:swLR')
        else:
            client.publish(b'relay', b'OFF:swLR')
        btn_state = True
    elif debounce(btn_state) == False and btn_state == True:
        # relay.value(0)
        btn_state = False
        
  except OSError as e:
      restart_and_reconnect()