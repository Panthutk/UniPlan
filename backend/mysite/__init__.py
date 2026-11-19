import os
import sys

import pymysql

pymysql.install_as_MySQLdb()

# Host pytest cannot resolve the Compose hostname "db", and port 3306 on this
# Mac is a different MySQL. Compose still injects DB_HOST=db and DB_PORT=3306.
if os.path.basename(sys.argv[0]).startswith("pytest") and not os.path.exists("/.dockerenv"):
    os.environ["DB_HOST"] = "127.0.0.1"
    os.environ["DB_PORT"] = "3307"