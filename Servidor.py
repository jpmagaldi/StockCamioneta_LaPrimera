import logging
import sys, os
import time
from flask import Flask, request, jsonify
import mysql.connector
import qrcode
import base64
from pathlib import Path
import io
from datetime import datetime, timedelta
from Afip.wsaa import WSAA
from Afip.wsfev1 import WSFEv1
from waitress import serve
import traceback


# ------- DATOS GENERALES -------
logger = logging.getLogger('waitress')
logger.setLevel(logging.DEBUG)

DATE = datetime.now().strftime("%Y%m%d")
DATE1 = datetime.now().strftime("%Y-%m-%d")

base_dir = Path.home() / 'La_Primera_Software'
base_dir.mkdir(parents=True, exist_ok=True)


def resource_path(relative_path):
	""" Get absolute path to resource, works for dev and for PyInstaller """
	base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
	return os.path.join(base_path, relative_path)


def CrearLogs(self):
	""" Crea o agrega a un logs.txt (en carpeta raíz) la informacion del error """
	f = open(base_dir / 'logs.txt', "a")
	f.write(datetime.now().strftime("%d/%m/%Y") + ':' + '\n')
	for i in sys.exc_info():
		f.write(str(i) + '\n')
	f.write('\n')
	f.write(traceback.format_exc())
	f.write('------------' + '\n')
	f.close()



# ------- DATOS PARA AFIP -------
URL_QR = "https://www.afip.gob.ar/fe/qr/"


CUIT = None
Produccion = True


class ConnectionManager:
	def __init__(self):
		global CUIT
		self.db = None
		self.wsaa = WSAA()
		self.wsfe = WSFEv1()
		
		cert_dir = base_dir / 'Certificados'
		
		if Produccion:
			self.wsfe.Cuit = CUIT = 30670206528
			self.cert = str(cert_dir / 'productioncrt.crt')
			self.key = str(cert_dir / 'privada.key')
			self.wsfe.WSDL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL"
			self.wsaa.WSDL = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl"
			self.wsaa.WSAAURL = "https://wsaa.afip.gov.ar/ws/services/LoginCms"
		else:
			self.wsfe.Cuit = CUIT  = 20218452788
			self.cert = str(cert_dir / 'empresa.crt')
			self.key = str(cert_dir / 'privadatesting.key')
			self.wsfe.WSDL = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
			self.wsaa.WSDL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl"
			self.wsaa.WSAAURL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"

	def get_db(self):
		""" Retorna la conexión a DB, reconectando si es necesario """
		try:
			if self.db is None or not self.db.is_connected():
				print("DB: Conectando...")
				self.db = mysql.connector.connect(
					host='192.168.0.142', password='ventas', user='ventas',
					#host='127.0.0.1', port=3306, user='root', password='1234',
					database='negocio', connection_timeout=5
				)
				self.db.autocommit = False
				self.db.start_transaction(isolation_level='READ COMMITTED')
				print("DB: Conectado correctamente.")
			return self.db
		except Exception as e:
			CrearLogs(e)
			return None

	def init_afip(self):
		""" Inicializa el ticket de acceso AFIP """
		try:
			print("AFIP: Conectando...")
			self.wsfe.Conectar()
			ticket = self.wsaa.Autenticar("wsfe", self.cert, self.key)
			if ticket:
				self.wsfe.SetTicketAcceso(ticket)
				print("AFIP: Conectado y Autenticado.")
				return True
			return False
		except Exception as e:
			CrearLogs(e)
			return False

manager = ConnectionManager()



# ------- APP FLASK -------
app = Flask(__name__)


# ------- METODOS GENERALES -------
@app.route("/getFecha", methods=["GET"])
def get_fecha():
	try:
		now = datetime.now()
		fecha = now.strftime("%d/%m/%Y")
		arr = [fecha]
		return jsonify(arr)
	except Exception as e:
		CrearLogs(e)
		return jsonify([])

@app.route("/getLastVoucher", methods=["POST"])
def get_last_voucher():
	try:
		tipo = int(request.json.get("tipo"))
		ptoventa = int(request.json.get("ptoventa"))
		if tipo != 99:
			try:
				factura = manager.wsfe.CompUltimoAutorizado(tipo, ptoventa)
				return jsonify(int(factura) + 1)
			except Exception as e:
				CrearLogs(e)
				return jsonify(None)
		else:
			db = manager.get_db()
			with db.cursor(dictionary=True) as cursor:
				qry = "SELECT Numero FROM negocio.numeracion WHERE PtoVenta LIKE '%s'" % str(ptoventa).zfill(4)
				cursor.execute(qry)
				row = cursor.fetchone()
				return jsonify(int(row["Numero"]) + 1)
	except Exception as e:
		CrearLogs(e)
		return jsonify(None)

@app.route("/getVoucher", methods=["POST"])
def get_voucher():
	try:
		arr = []
		Retext = int(request.json.get("Retext"))
		getPtoventa = int(request.json.get("getPtoventa"))
		radioSelect = int(request.json.get("radioSelect"))
		try:
			arr = manager.wsfe.CompConsultar(Retext, getPtoventa, radioSelect)
		except Exception as e:
			print(e)
		return jsonify(arr)
	except Exception as e:
		CrearLogs(e)
		return jsonify([])


def calculoTotal(Fecha, PtoVta): 
	db = manager.get_db()
	with db.cursor(dictionary=True) as cursor:
		Query = "SELECT SUM(Total) as Total FROM negocio.ventas INNER JOIN camioneta.clientes AS c \
			ON ventas.Cuit = c.Cuit WHERE Fecha LIKE '%s' AND N_Fact LIKE '%s-%%' \
			AND c.Duplicado NOT LIKE '1'" % (Fecha, PtoVta)
		cursor.execute(Query)
		rows3 = cursor.fetchone()

		Query1 = "SELECT SUM(Total) as Total FROM negocio.presupuestos WHERE Fecha LIKE '%s' AND \
			N_Presu LIKE '%s-%%'" % (Fecha, PtoVta)
		cursor.execute(Query1)
		rows4 = cursor.fetchone()

	try:
		if rows3['Total'] and rows4['Total']:
			total = round(float(rows3['Total']) + float(rows4['Total']), 2)
		elif rows3['Total']:
			total = round(float(rows3['Total']), 2)
		elif rows4['Total']:
			total = round(float(rows4['Total']), 2)
		else:
			total = '0.00'
	except:
		total = 'error'
	finally:
		return total


# ------- RUTAS -------
@app.route("/facturacion", methods=["POST"])
def facturacion():
	try:
		comp = ""

		data_req = request.json
		cliente = data_req["cliente"]
		if cliente[5] == 'EXENTO':
			return jsonify({"error": "Exento error"})
		
		Cuitcliente = cliente[0].replace("-", "")
		total = float(data_req["total"])
		tipo = int(data_req["tipo"])
		NroFact = int(data_req["NroFact"])
		if data_req.get("NroFactD") != '':
			NroFactD = int(data_req["NroFactD"])
		else:
			NroFactD = ''
		PtoVta = int(data_req["ptoventa"])
		items = data_req["items"]
		itemsC = data_req["itemsC"]

		formatfact = f"{str(PtoVta).zfill(4)}-{str(NroFact).zfill(8)}"

		# Calculos de neto e iva
		neto = round(total / 1.21, 2)
		iva = '{:.2f}'.format(round(total - neto, 2))
		neto = '{:.2f}'.format(neto)
		total = '{:.2f}'.format(total)

	# Generamos el CAE
		try:
			cae, cae_vto, comp, err, obs = generarCAE(
				Cuitcliente, tipo, NroFact, NroFactD, 
				DATE, PtoVta, total, neto, iva
			)
		except Exception as e:
			CrearLogs(e)
			return jsonify({"error": "CAE error"})

		# Guardamos en la base de datos
		if not InsertFacturaBD(DATE, comp, formatfact, cliente, neto, iva, total, tipo, items, itemsC):
			return jsonify({"error": "BD error"})

		
		# Generamos el QR para la factura
		FormatTotal = total.replace('.','')

		cuerpo = f'{{"ver":1,"fecha":"{DATE1}","cuit":{CUIT},"ptoVta":{PtoVta},"tipoCmp":{tipo},"nroCmp":{NroFact},"importe":{FormatTotal},"moneda":"PES","ctz":1,"tipoDocRec":80,"nroDocRec":{int(Cuitcliente)},"tipoCodAut":"E","codAut":{cae}}}'
		to_qrurl = URL_QR + "?p=" + base64.b64encode(cuerpo.encode()).decode()
		
		qr_obj = qrcode.QRCode(
			version=None,
			error_correction=qrcode.constants.ERROR_CORRECT_M,
			box_size=4,
			border=1,
		)
		qr_obj.add_data(to_qrurl)
		qr_obj.make(fit=True)
		img = qr_obj.make_image(fill_color="black", back_color="white")
		
		buf = io.BytesIO()
		img.save(buf, format="PNG")
		qr_base64 = base64.b64encode(buf.getvalue()).decode()

		fecha_vto = f"{cae_vto[6:8]}/{cae_vto[4:6]}/{cae_vto[0:4]}"
		
		return jsonify({"error": None, "qr_base64": qr_base64, "cae": cae, "fecha_vto": fecha_vto, "neto": neto, "iva": iva})
	except Exception as e:
		CrearLogs(e)
		return jsonify({"error": "Error desconocido"})

def generarCAE(Cuitcliente, tipo, NroFact, NroFactD, 
	date, PtoVta, total, neto, iva):
		manager.wsfe.CrearFactura(
			concepto=1, tipo_doc=80, nro_doc=Cuitcliente, tipo_cbte=tipo,
			cbt_desde=NroFact , cbt_hasta=NroFact, fecha_cbte=date,
			punto_vta=PtoVta, cbte_nro=NroFact, imp_total=total, imp_tot_conc=0.00, 
			imp_neto=neto, imp_iva=iva, condicion_iva_receptor_id=1
		)
		manager.wsfe.AgregarIva(5, neto, iva)  # 21%

		if tipo == 3:
			comp = "Ncred. A"
			manager.wsfe.AgregarCmpAsoc(pto_vta=PtoVta, nro=NroFactD)
		else:
			comp = "Fact.A"

		cae = manager.wsfe.CAESolicitar()
		cae_vto = manager.wsfe.Vencimiento
		return [cae, cae_vto, comp, manager.wsfe.ErrMsg, manager.wsfe.Obs]

def InsertFacturaBD(date, comp, formatfact, cliente, 
	neto, iva, total, tipo, items, itemsC):
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			if tipo == 3:
				#Nota de credito
				qry = f"""INSERT INTO ventas (Fecha, Comprobante, N_fact, Cuit, Pan105, Pan21, Exento, Iva105, Iva21, Otros, Total)
						VALUES ('{date}','{comp}','{formatfact}','{cliente[0]}','0.00','-{neto}','0.00','0.00','-{iva}','0.00','-{total}');"""
				cursor.execute(qry)
				for elem in items:
					cursor.execute(f"""INSERT INTO venta_productos (N_fact, Comprobante, Producto, Cantidad, Precio_U, Cambio, Total)
								VALUES ('{formatfact}', '{comp}', '{elem[0]}', '-{elem[1]}', '-{elem[2]}', '0', '-{elem[3]}');""")
			else:  
				qry = f"""INSERT INTO ventas (Fecha, Comprobante, N_fact, Cuit, Pan105, Pan21, Exento, Iva105, Iva21, Otros, Total)
						VALUES ('{date}','{comp}','{formatfact}','{cliente[0]}','0.00','{neto}','0.00','0.00','{iva}','0.00','{total}');"""
				cursor.execute(qry)
				for elem in items:
					# Buscar si el producto tiene un cambio asociado
					cambio_val = "0"
					for c_item in itemsC:
						if c_item[0] == elem[0]:
							cambio_val = c_item[1]
							break
					cursor.execute(f"""INSERT INTO venta_productos (N_fact, Comprobante, Producto, Cantidad, Precio_U, Cambio, Total)
							VALUES ('{formatfact}', '{comp}', '{elem[0]}', '{elem[1]}', '{elem[2]}', '{cambio_val}', '{elem[3]}');""")
			
			nombres_en_venta = [e[0] for e in items]
			for c_item in itemsC:
				if c_item[0] not in nombres_en_venta:
					cursor.execute(f"""INSERT INTO venta_productos (N_fact, Comprobante, Producto, Cantidad, Precio_U, Cambio, Total)
									VALUES ('{formatfact}', '{comp}', '{c_item[0]}', '0', '{c_item[2]}', '{c_item[1]}', '0.00');""")
			db.commit()
			return True
	except:
		db.rollback()
		CrearLogs(e)
		return False

# --------------

@app.route("/presupuesto", methods=["POST"])
def presupuesto():
	try:
		data_req = request.json
		cliente = data_req["cliente"]
		PtoVta = int(data_req["PtoVta"])
		N_Presu = data_req["N_Presu"]
		Total = data_req["Total"]
		items = data_req["items"]
		itemsC = data_req["itemsC"]
		
		fact = '%s-%s' % (str(PtoVta).zfill(4), str(N_Presu).zfill(8))

		#fecha_db = datetime.strptime(str(Fecha[0]), "%d/%m/%Y").strftime("%Y-%m-%d")

		aux = InsertPresupuestoBD(cliente, PtoVta, fact, N_Presu, Total, items, itemsC)

		if aux == True:
			return jsonify({'error': None})
		elif aux == False:
			return jsonify({'error': "Duplicado"})
		else:
			return jsonify({'error': "Error desconocido"})
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': "Error desconocido"})

def InsertPresupuestoBD(cliente, PtoVta, fact, N_Presu, Total, items, itemsC):
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			try:
				Query = "INSERT INTO negocio.presupuestos(Fecha, Cuit, N_Presu, Total) \
				VALUES ('%s', '%s', '%s', '%s');" % (DATE, cliente[0], fact, Total)
				cursor.execute(Query)

				for i in range(len(items)):
					# Buscar si el producto tiene un cambio asociado en presupuestos
					cambio_val = "0"
					for c_item in itemsC:
						if c_item[0] == items[i][0]:
							cambio_val = c_item[1]
							break

					Query = "INSERT INTO negocio.presu_productos(N_pres, Producto, \
						Cantidad, Precio_U, Cambio, Total) VALUES ( '%s', '%s', '%s', \
					'%s', '%s', '%s');" % (fact, items[i][0], items[i][1], 
					items[i][2], cambio_val, items[i][3])
					cursor.execute(Query)
				
				# Procesar el resto de itemsC que no están en la venta
				nombres_en_venta = [e[0] for e in items]
				for c_item in itemsC:
					if c_item[0] not in nombres_en_venta:
						Query = "INSERT INTO negocio.presu_productos(N_pres, Producto, \
							Cantidad, Precio_U, Cambio, Total) VALUES ( '%s', '%s', '%s', \
						'%s', '%s', '%s');" % (fact, c_item[0], '0', 
							c_item[2], c_item[1], '0.00')
						cursor.execute(Query)
			
				Query = "UPDATE negocio.numeracion SET Numero = '%s' WHERE PtoVenta = '%s';" % (N_Presu, str(PtoVta).zfill(4))
				cursor.execute(Query)

				db.commit()
				return True
			except Exception as e:
				db.rollback()
				CrearLogs(e)
				if "Duplicate entry" in str(e) or (hasattr(e, 'errno') and e.errno == 1062):
					return False
				else:
					return 'Error desconocido'
				   
	except Exception as e:
		CrearLogs(e)
		return False

# --------------

@app.route("/cambio", methods=["POST"])
def cambios():
	try:
		data_req = request.json
		itemsC = data_req["itemsC"]
		cliente = data_req["cliente"]

		if InsertCambios(itemsC, cliente, DATE):
			return jsonify({"error": None})
		else:
			return jsonify({"error": "Cambios error"})
	except Exception as e:
		CrearLogs(e)
		return jsonify({"error": "Cambios error interno"})

def InsertCambios(itemsC, cliente, date):
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			for i in range(len(itemsC)):
				Query = "INSERT INTO negocio.cambio_sin_ventas(Fecha, Cuit, Producto, Cantidad)\
					VALUES ('%s', '%s', '%s', '%s');" % (date, cliente[0], itemsC[i][0], itemsC[i][1])
				cursor.execute(Query)
			db.commit()
		return True
	except Exception as e:
		CrearLogs(e)
		db.rollback()
		return False

# --------------


@app.route('/listaPrecios', methods=['POST'])
def lista_precios():
	try:
		arr = []
		lista = request.json.get('lista')
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			qry = "SELECT Nombre, Precio FROM camioneta.productos WHERE Lista LIKE '%s' AND Precio NOT LIKE '0.0%%'" % lista
			cursor.execute(qry)
			rows = cursor.fetchall()
			for row in rows:
				arr.append([row["Nombre"], row["Precio"]])
		return jsonify({"error": None, "arr": arr})
	except Exception as e:
		CrearLogs(e)
		return jsonify({"error": "Error interno"})

# --------------

@app.route('/rankingFact', methods=['POST'])
def rankingFact():
	try:
		PtoVta = request.json.get('PtoVta')
		Fecha = request.json.get('Fecha')
		db = manager.get_db()
		
		with db.cursor(dictionary=True) as cursor:
			db.rollback()
			Query = "SELECT SUBSTRING(c.RazonS,1,26), Comprobante,N_fact,Total FROM negocio.ventas as v INNER JOIN negocio.clientes as c \
				ON v.Cuit = c.Cuit WHERE Fecha LIKE '%s' AND v.N_fact LIKE '%s-%%'\
				ORDER BY Fecha DESC" % (Fecha, PtoVta)
			cursor.execute(Query)
			rowF = cursor.fetchall()
		
			Query = "SELECT SUBSTRING(c.RazonS,1,26), N_Presu, Total FROM negocio.presupuestos as v INNER JOIN negocio.clientes as c \
				ON v.Cuit = c.Cuit WHERE Fecha LIKE '%s' AND v.N_Presu LIKE '%s%%'\
				ORDER BY Fecha DESC" % (Fecha, PtoVta)
			cursor.execute(Query)
			rows2 = cursor.fetchall()

			total = calculoTotal(Fecha, PtoVta)
			
		return jsonify({'error': None, 'rowF' : rowF, 'rowP' : rows2, 'total' : total})
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error de conexión'})

# --------------

@app.route("/getStockInfo", methods=["POST"])
def getStockInfo():
	try:
		Fecha = request.json.get('Fecha')
		PtoVenta = request.json.get('PtoVenta')
		Tabla1, Tabla2, Tabla3, Tabla4, Tabla5, Tabla6, Tabla7 = [], [], [], [], [], [], []
		
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			db.rollback()
			Query = "SELECT Accion, Nombre, SUM(Cantidad) as Cantidad FROM negocio.stock_camioneta\
				WHERE Fecha LIKE '%s' GROUP BY Accion, Nombre" % (Fecha)
			cursor.execute(Query)
			rows = cursor.fetchall()

			Query = "SELECT Producto, SUM(Cantidad) as Cantidad FROM negocio.cambio_sin_ventas\
				WHERE Fecha LIKE '%s' GROUP BY Producto" % (Fecha)
			cursor.execute(Query)
			rows2 = cursor.fetchall()

			for row in rows:
				if row['Accion'] == '0':      #Stock Inicial
					Tabla1.append([row['Nombre'], row['Cantidad']])
				elif row['Accion'] == '1':    #Carga Fabrica
					Tabla2.append([row['Nombre'], row['Cantidad']])
				elif row['Accion'] == '2':    #Negocio
					Tabla3.append([row['Nombre'], row['Cantidad']])
				elif row['Accion'] == '3':    #Carga Negocio
					Tabla6.append([row['Nombre'], row['Cantidad']])

			for row in rows2:
				Tabla7.append([row['Producto'], row['Cantidad']])

			QueryVenta = "SELECT Producto, ROUND(SUM(Cantidad), 4) AS Cantidad_Total, \
				SUM(Cambio) AS Cambio_Total FROM \
				(SELECT VP.Producto, VP.Cantidad, VP.Cambio \
					FROM venta_productos AS VP \
						INNER JOIN ventas AS V \
						ON VP.N_fact = V.N_fact AND VP.Comprobante = V.Comprobante \
						WHERE Fecha LIKE '%s' \
							AND V.N_fact LIKE '%s-%%' \
				UNION ALL\
				SELECT VP.Producto, VP.Cantidad, VP.Cambio \
					FROM presu_productos AS VP \
						INNER JOIN presupuestos AS V \
						ON VP.N_Pres = V.N_Presu \
					WHERE Fecha LIKE '%s' \
						AND V.N_Presu LIKE '%s-%%') AS combinados\
					GROUP BY Producto" % (Fecha, PtoVenta, Fecha, PtoVenta)
			cursor.execute(QueryVenta)
			Tabla4 = cursor.fetchall()

		# Lógica para Tabla5 (Stock Final)
		stock_map = {}

		# Sumar Tabla1 (Stock Inicial) y Tabla2 (Carga Fabrica) y Tabla6 (Carga Negocio)
		for item in Tabla1:
			nombre, cantidad = item[0], float(item[1])
			stock_map[nombre] = stock_map.get(nombre, 0) + cantidad
		
		for item in Tabla2:
			nombre, cantidad = item[0], float(item[1])
			stock_map[nombre] = stock_map.get(nombre, 0) + cantidad
		
		for item in Tabla6:
			nombre, cantidad = item[0], float(item[1])
			stock_map[nombre] = stock_map.get(nombre, 0) + cantidad

		# Restar Tabla3 (Negocio), Tabla4 (Ventas + Cambios) y Tabla7 (Cambios sin ventas)
		for item in Tabla3:
			nombre, cantidad = item[0], float(item[1])
			stock_map[nombre] = stock_map.get(nombre, 0) - cantidad
		
		for item in Tabla7:
			nombre, cantidad = item[0], float(item[1])
			stock_map[nombre] = stock_map.get(nombre, 0) - cantidad


		for row in Tabla4:
			nombre = row['Producto']
			cantidad = float(row['Cantidad_Total']) if row['Cantidad_Total'] else 0
			cambios = float(row['Cambio_Total']) if row['Cambio_Total'] else 0
			stock_map[nombre] = stock_map.get(nombre, 0) - (cantidad + cambios)

		# Convertir a formato de lista para el frontend
		Tabla5 = [[nombre, round(cantidad, 4)] for nombre, cantidad in stock_map.items()]

		total = calculoTotal(Fecha, PtoVenta)
		return jsonify({
			'error': None,
			'Tabla1' : Tabla1, 
			'Tabla2' : Tabla2,
			'Tabla3' : Tabla3, 
			'Tabla4' : Tabla4, 
			'Tabla5' : Tabla5,
			'Tabla6' : Tabla6,
			'Tabla7' : Tabla7,
			'Total' : total
		})
	except Exception as e:
		CrearLogs(e)
		return jsonify(None)

# ------ RUTAS UNICAS DE STOCK --------

@app.route('/getProductosNegocio', methods=['GET'])
def getProductosNegocio():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			qry = "SELECT Nombre FROM camioneta.productos WHERE Nombre LIKE '%%' AND Precio NOT LIKE '0.00%' GROUP BY Nombre"
			cursor.execute(qry)
			rows = cursor.fetchall()
			arr = []
			for row in rows:
				arr.append(row['Nombre'])
			return jsonify(arr)
	except Exception as e:
		CrearLogs(e)
		return jsonify([])

# --------------

@app.route('/postProductosNegocio', methods=['POST'])
def postProductosNegocio():
	try:
		Productos = request.json.get('Productos')
		Tipo = request.json.get('Tipo')
		
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			for row in Productos:
				query = "INSERT INTO negocio.stock_camioneta (Fecha, Accion, Nombre, Cantidad)\
					VALUES ('%s', '%s', '%s', '%s')" % (DATE1, Tipo, row['nombre'], row['cantidad'])
				cursor.execute(query)
			db.commit()
		return jsonify({'error': None})
	except Exception as e:
		CrearLogs(e)
		db.rollback()
		return jsonify({'error': 'Error al insertar los datos'})

# --------------

@app.route('/searchInicio', methods=['GET'])
def searchInicio():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True, buffered=True) as cursor:
			query = "SELECT * FROM negocio.stock_camioneta WHERE Fecha LIKE '%s' AND Accion = '0'" % (DATE1)
			cursor.execute(query)
			rows = cursor.fetchone()
		if rows:
			return jsonify({'error': None})
		else:
			return jsonify({'error': 'Hay datos cargados'})
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error al insertar los datos'})

# --------------

@app.route('/searchFabrica', methods=['GET'])
def searchFabrica():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			query = "SELECT * FROM negocio.stock_camioneta WHERE Fecha LIKE '%s' AND Accion = '1'" % (DATE1)
			cursor.execute(query)
			rows = cursor.fetchall()
		return jsonify(rows)
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error al insertar los datos'})

# --------------

@app.route('/searchNegocio', methods=['GET'])
def searchNegocio():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			query = "SELECT * FROM negocio.stock_camioneta WHERE Fecha LIKE '%s' AND Accion = '2'" % (DATE1)
			cursor.execute(query)
			rows = cursor.fetchall()
		return jsonify(rows)
	except Exception as e:
		CrearLogs(e)
		return jsonify([])

# --------------

@app.route('/reImprimir', methods=['POST'])
def reimprimir():
	try:
		nro = request.json.get('nro')
		pto = request.json.get('pto')
		tipo = request.json.get('tipo')

		manager.wsfe.CompConsultar(tipo, pto, nro)

		cae = manager.wsfe.CAE
		vto = manager.wsfe.Vencimiento[-2:] + '/' + manager.wsfe.Vencimiento[-4:-2] + '/' + manager.wsfe.Vencimiento[:4]

		if tipo == 1:
			tipo = 'Fact.A'
		else:
			tipo = 'Ncred. A'

		db = manager.get_db()			
		with db.cursor(dictionary=True) as cursor:
			db.rollback()
			qry = "SELECT * FROM negocio.ventas WHERE N_fact LIKE '%s-%s' AND Comprobante LIKE '%s'" % (pto.zfill(4), nro.zfill(8), tipo)
			cursor.execute(qry)
			rowF = cursor.fetchone()

			if rowF:
				cliente = "SELECT * FROM camioneta.clientes WHERE Cuit LIKE '%s'" % rowF['Cuit']
				cursor.execute(cliente)
				cliente = cursor.fetchone()

				productos = "SELECT * FROM negocio.venta_productos WHERE N_fact LIKE '%s-%s' AND Comprobante LIKE '%s'" % (pto.zfill(4), nro.zfill(8), tipo)
				cursor.execute(productos)
				productos = cursor.fetchall()
			else:
				return jsonify({'error': 'Vacio'})
		
		arrC = [cliente["RazonS"], cliente["Cuit"], cliente["Direccion"], cliente["Responsabilidad"]]
		arrP = []

		Fecha = rowF['Fecha'].strftime("%d/%m/%Y")
		CUIT = rowF['Cuit']
		cuitcliente = CUIT.replace('-','')
		total = rowF['Total']

		arrF = [Fecha, rowF['N_fact'], rowF['Pan21'], rowF['Iva21'], rowF['Total'], cae, vto]

		for row in productos:
			arrP.append([
				row["Producto"],
				row["Cantidad"],
				row["Precio_U"],
				row["Total"]
			])

		Fechacbt = rowF['Fecha']

		# QR
		cuerpo = f'{{"ver":1,"fecha":"{Fechacbt}","cuit":{CUIT},"ptoVta":{pto},"tipoCmp":{tipo},"nroCmp":{nro},"importe":{total},"moneda":"PES","ctz":1,"tipoDocRec":80,"nroDocRec":{int(cuitcliente)},"tipoCodAut":"E","codAut":{cae}}}'
		to_qrurl = URL_QR + "?p=" + base64.b64encode(cuerpo.encode()).decode()
		
		qr_obj = qrcode.QRCode(
			version=None,
			error_correction=qrcode.constants.ERROR_CORRECT_M,
			box_size=4,
			border=1,
		)
		qr_obj.add_data(to_qrurl)
		qr_obj.make(fit=True)
		img = qr_obj.make_image(fill_color="black", back_color="white")
		
		buf = io.BytesIO()
		img.save(buf, format="PNG")
		qr_base64 = base64.b64encode(buf.getvalue()).decode()
		
		arrF.append(qr_base64)
		
		return jsonify(arrC, arrP, arrF)
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error interno del servidor'})

@app.route('/reImprimirPres', methods=['POST'])
def reImprimirPres():
	try:
		nro = request.json.get('nro')
		pto = request.json.get('pto')

		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			qry = "SELECT * FROM negocio.presupuestos WHERE N_Presu LIKE '%s-%s'" % (pto.zfill(4), nro.zfill(8))
			cursor.execute(qry)
			rowF = cursor.fetchone()

			if rowF:
				cliente = "SELECT * FROM camioneta.clientes WHERE Cuit LIKE '%s'" % rowF['Cuit']
				cursor.execute(cliente)
				cliente = cursor.fetchone()

				productos = "SELECT * FROM negocio.presu_productos WHERE N_pres LIKE '%s-%s' " % (pto.zfill(4), nro.zfill(8))
				cursor.execute(productos)
				productos = cursor.fetchall()
			else:
				return jsonify({'error': 'Vacio'})
		
		arrC = [cliente["RazonS"], cliente["Cuit"]]
		arrP = []

		Fecha = rowF['Fecha'].strftime("%d/%m/%Y")

		arrF = [Fecha, rowF['N_Presu'], rowF['Total']]
		
		for row in productos:
			arrP.append([
				row["Producto"],
				row["Cantidad"],
				row["Precio_U"],
				row["Total"]
			])
		
		return jsonify(arrC, arrP, arrF)

	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error interno del servidor'})
# --------------

@app.route('/eliminarPresupuesto', methods=['POST'])
def eliminar_presupuesto():
	db = None
	try:
		nro = request.json.get('nro')
		pto = request.json.get('pto')
		fact = f"{str(pto).zfill(4)}-{str(nro).zfill(8)}"

		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			#cursor.execute("DELETE FROM negocio.presu_productos WHERE N_pres = %s", (fact,))
			cursor.execute("DELETE FROM negocio.presupuestos WHERE N_Presu = %s", (fact,))
			db.commit()
		return jsonify({'error': None})
	except Exception as e:
		CrearLogs(e)
		if db:
			db.rollback()
		return jsonify({'error': 'Error al eliminar el presupuesto'})

# --------------

@app.route('/buscarCliente', methods=['GET'])
def buscar_cliente():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			db.rollback()
			qry = """
				SELECT RazonS, Alias, Cuit, Direccion, Responsabilidad, Lista,
					Descuento, Recargo, Duplicado
				FROM camioneta.clientes
				ORDER BY RazonS
			"""
			cursor.execute(qry)
			rows = cursor.fetchall()

			arr = []

			for row in rows:
				arr.append([
					row["Cuit"],           # 0
					row["RazonS"],         # 1
					row["Alias"],          # 2
					"",                    # 3
					row["Direccion"],      # 4
					row["Responsabilidad"],# 5
					row["Lista"],          # 6
					row["Descuento"],      # 7
					row["Recargo"],        # 8
					row["Duplicado"]       # 9
				])

		return jsonify({'error': None, 'arr': arr})

	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error interno del servidor'})

# --------------

@app.route('/buscarProductos', methods=['GET'])
def buscar_productos():
	try:
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			qry = "SELECT Nombre, Lista, Precio, Iva FROM camioneta.productos ORDER BY Nombre"
			cursor.execute(qry)
			rows = cursor.fetchall()

			arr = []

			for row in rows:
				arr.append([
					row["Nombre"],  # 0
					row["Lista"],   # 1
					row["Precio"],  # 2
					row["Iva"]      # 3
				])
		return jsonify({'error': None, 'arr': arr})
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error interno del servidor'})





@app.route('/getProductosStock', methods=['GET'])
def getProductosStock():
	try:
		db = manager.get_db()
		db.rollback()
		with db.cursor(dictionary=True) as cursor:
			qry = "SELECT Barcode, Nombre, Imagen, Cantidad, Categoria, Medida FROM negocio.productostock ORDER BY Nombre"
			cursor.execute(qry)
			rows = cursor.fetchall()
			arr = []
			for row in rows:
				arr.append([
					row["Barcode"],
					row["Nombre"],
					row["Imagen"],
					row["Cantidad"],
					row["Categoria"],
					row["Medida"],
				])

		return jsonify({'error': None, 'items': arr})
	except Exception as e:
		CrearLogs(e)
		return jsonify({'error': 'Error interno del servidor'})


@app.route('/descontarStock', methods=['POST'])
def descontarStock():
	try:
		id = request.json.get('id')
		cantidad = request.json.get('cantidad')
		print(id, cantidad)
		db = manager.get_db()
		with db.cursor(dictionary=True) as cursor:
			qry = "UPDATE negocio.productostock SET Cantidad = %s WHERE Barcode = '%s'" % (cantidad, id)
			cursor.execute(qry)
			db.commit()
			return jsonify({'error': None})
	except:
		return jsonify({'error': 'Error'})




if __name__ == "__main__":
	#while True:
	try:
		print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando conexión...")
		manager.get_db()
		manager.init_afip()
		app.run(host='0.0.0.0', port=5000, debug=True) #Para testing
		#serve(app, host='0.0.0.0', port=5000) #Para produccion
	except KeyboardInterrupt:
		print("\nServidor detenido manualmente por el usuario.")
		#break
	except Exception as e:
		print(f"[{datetime.now().strftime('%H:%M:%S')}] Error crítico en el servidor: {e}")
		CrearLogs(e)
		print("Reiniciando servidor en 5 segundos...")
		time.sleep(5)

