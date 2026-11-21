import os
import sys

import pymysql

pymysql.install_as_MySQLdb()

# Host pytest cannot resolve the Compose hostname "db", and port 3306 on local
# machines may be a different MySQL. Respect explicitly configured env vars (e.g. CI).
if os.path.basename(sys.argv[0]).startswith("pytest") and not os.path.exists("/.dockerenv"):
    os.environ.setdefault("DB_HOST", "127.0.0.1")
    os.environ.setdefault("DB_PORT", "3307")