from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///leaderboard.db'
app.secret_key = 'phoenixpavel'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)

class Leaderboard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    time = db.Column(db.Integer, nullable=False)

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already taken. Please choose a different one.')
        else:
            new_user = User(username=username, password=password)
            db.session.add(new_user)
            db.session.commit()

            new_time = Leaderboard(username=username, time=0)
            db.session.add(new_time)
            db.session.commit()

            flash('User registered successfully!')
            return redirect(url_for('home'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username, password=password).first()
        if user:
            session['username'] = user.username
            flash('Login successful!')
            return redirect(url_for('landing'))
        else:
            flash('Invalid username or password.')
    
    return render_template('login.html')

@app.route('/camera', methods=['GET', 'POST'])
def camera():

    leaderboard_entry = Leaderboard.query.filter_by(username=session['username']).first()
    timeToBeat = leaderboard_entry.time


    return render_template('camera.html', timeToBeat=timeToBeat)

@app.route('/final_count/<string:typeDetected>/<int:timeInSeconds>', methods=['GET'])
def final_count(typeDetected, timeInSeconds):

    print(timeInSeconds)

    leaderboard_entry = Leaderboard.query.filter_by(username=session['username']).first()

    if leaderboard_entry:
         if timeInSeconds > leaderboard_entry.time:
            leaderboard_entry.time = timeInSeconds
            db.session.commit()

    return render_template('final_count.html', timeInSeconds = timeInSeconds, typeDetected = typeDetected)

@app.route('/landing')
def landing():
    if 'username' not in session:
        flash('You are not logged in.')
        return redirect(url_for('login'))

    username = session['username']
    leaderboard = Leaderboard.query.order_by(Leaderboard.time.desc()).all()

    return render_template('landing.html', username=username, leaderboard=leaderboard)

@app.route('/logout')
def logout():
    session.pop('username', None)
    flash('You have been logged out.')
    return redirect(url_for('home'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)