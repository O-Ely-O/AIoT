from flask import Flask, render_template, Response, redirect, url_for, request, jsonify, send_file, flash, session, make_response
from .forms import RegisterForm, LoginForm, PinpadForm
from models import db, User
from flask_bcrypt import Bcrypt
from flask_mqtt import Mqtt

from ultralytics import YOLO
import supervision as sv

#Load models
MODEL = 'models/yolov8n.pt'

# Instantiate connection to PostgresDB
with open ("secret.yml", 'r') as f:
    data = yaml.full_load(f)

param_dic = {
    "host"      : data.get('host'),
    "database"  : data.get('database'),
    "user"      : data.get('user'),
    "password"  : data.get('password')
}

app = Flask(__name__)

app.config['MQTT_BROKER_URL'] = 'mqtt.flespi.io' # Here you can initialize your own mqtt-broker
app.config['MQTT_BROKER_PORT'] = 1883
app.config['MQTT_USERNAME'] = '<YOUR API KEY- IN FLESPI.IO>'
app.config['MQTT_PASSWORD'] = None
app.config['SECRET_KEY'] = 'secret'
app.config['SQLALCHEMY_DATABASE_URI'] = '<SET YOUR DB URI HERE>'
bcrypt = Bcrypt()

mqtt_client = Mqtt(app)
topic = [("temperature",0),("switch",0),("relay",0)]

db.init_app(app)
bcrypt.init_app(app)

with app.app_context():
    db.create_all()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usr_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Ensure responses aren't cached
@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def connect(params_dic):
    """ Connect to the PostgreSQL database server """
    conn = None
    try:
        # connect to the PostgreSQL server
        print('Connecting to the PostgreSQL database...')
        conn = psycopg2.connect(**params_dic)
    except (Exception, psycopg2.DatabaseError) as error:
        print(error)
        sys.exit(1)
    print("Connection successful")
    return conn

@mqtt_client.on_connect()
def handle_connect(client, userdata, flags, rc):
    if rc == 0:
        print('Connected successfully')
        mqtt_client.subscribe(topic)
    else:
        print('Bad connection. Code:', rc)

@mqtt_client.on_message()
def handle_mqtt_message(client, userdata, message):
    data = dict(
        topic = message.topic,
        payload = message.payload.decode()
    )
    if data["topic"] == "temperature":
        print('Received message on topic: {topic} with payload: {payload}'.format(**data))

    elif data["topic"] == "switch":
        # print('Received message on topic: {topic} with payload: {payload}'.format(**data))
        print("test-swtich")

    elif data["topic"] == "relay":
        # print('Received message on topic: {topic} with payload: {payload}'.format(**data))
        print("test-relay")

def find_camera(id):
    cameras = ['test_video/test2.mp4','test_video/test3.mp4']
    return cameras[int(id)]
#  for cctv camera use rtsp://username:password@ip_address:554/user=username_password='password'_channel=channel_number_stream=0.sdp' instead of camera
#  for webcam use zero(0)

def get_frames(camera_id):
    #initialize the YOLOv8 model here
    model = YOLO(MODEL)
    model.fuse()
    box_annotator = sv.BoxAnnotator(
    thickness=1,
    text_thickness=1,
    text_scale=1
    )
    cam = find_camera(camera_id)
    video = cv2.VideoCapture(cam)  # detected video path
    while True:
        start_time = time.time()
        ret, frame = video.read()
        result = model(frame)[0]
        detections = sv.Detections.from_ultralytics(result)
        # detections = detect_objects(frame)
        # publish_detection_results(detections)
        
        if not ret:
            break
        frame = box_annotator.annotate(scene=frame, detections=detections)
        ret, jpeg = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')   
        elapsed_time = time.time() - start_time
        logging.debug(f"Frame generation time: {elapsed_time} seconds")

# Route to render the HTML template-
@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route("/login", methods=['GET','POST'])
def login():
    if 'usr_id' in session:
        return redirect(url_for('mqtt_temp'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            session['usr_id'] = user.id
            session['username'] = user.username
            flash('You have been Logged in!', 'success')
            return redirect(url_for('mqtt_temp'))
            
        else:
            flash('INVALID PASSWORD', 'danger')
            
    return render_template('login.html', form=form)

@app.route("/register", methods=['GET','POST'])
def register():
    if 'usr_id' in session:
        return redirect(url_for('mqtt_temp'))
    form = RegisterForm()

    if form.validate_on_submit():
        hased_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user = User(
            username = form.username.data,
            email = form.email.data,
            password = hased_password,
        )
        db.session.add(user)
        db.session.commit()
        flash("New Account Created!", "success")
        return redirect(url_for('login'))

    
    return render_template('register.html', form=form)

@app.route("/surveillance", methods=['GET','POST'])
@login_required
def video_f():
    form = PinpadForm()
    return render_template("videoFeed.html", form=form)

@app.route("/panel", methods=['GET','POST'])
@login_required
def mqtt_temp():
    header = ("id", "temperature", "created_at")
    conn = connect(param_dic)
    cur = conn.cursor()
    cur.execute("""SELECT * FROM temp_dim;""")
    col = cur.fetchall()
    
    form = PinpadForm()
    if request.method == "POST":
        req_key = list(request.form.keys())[0]
        req_val = list(request.form.values())[0]
        print(f"{req_key} {req_val}")
        #print(type(session['usr_id']))
        if int(req_val) is session['usr_id']:
            res = make_response("<h1>Success</h1>")
            res.status_code = 200
            return res
        else:
            res = make_response("<h1>Failed</h1>")
            res.status_code = 401
            return res     

    
    return render_template('panel.html', col=header, data=col, form=form)

@app.route("/analytics")
@login_required
def analytics():
    header = ("id", "temperature", "created_at")
    conn = connect(param_dic)
    cur = conn.cursor()
    cur.execute("""SELECT * FROM temp_dim;""")
    col = cur.fetchall()
    
    form = PinpadForm()
    return render_template("analytics.html", col=header, data=col, form=form)

@app.route("/logout")
@login_required
def logout():
    session.pop('usr_id')
    session.pop('username')
    flash("You have been Logout", "success")
    return redirect(url_for('login'))

@app.route('/video_feed/<string:id>/', methods=["GET"])
def video_feed(id):
    return Response(get_frames(id),mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    app.run(host='127.0.0.1',port=4455,debug=False)
    model = YOLO('yolov8n.pt')