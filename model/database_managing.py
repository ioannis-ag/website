import sqlite3
with open('model/dbdesigner.sql', 'r') as sql_file:
    sql_script = sql_file.read()
conn = sqlite3.connect('model/volunteerData.sqlite')
conn.executescript(sql_script)
conn.commit()
conn.close()
