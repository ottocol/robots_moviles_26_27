# Uso de los Turtlebot del laboratorio 

La conexión con los robots se puede hacer en dos modos:

- **Escritorio remoto:** aquí ves el escritorio gráfico del Linux del robot, y usas lo que hay instalado en él. Puedes copiar archivos desde y hacia el robot con un software especial (SCP). No es necesario que tengas ROS2 en tu ordenador, usas el ROS2 del robot. Funciona mejor en Windows.

- **Modo multimáquina:** necesitas tener instalado ROS2 en tu ordenador, puedes usar lo que tengas instalado en el ROS2 de tu ordenador en combinación con los paquetes básicos del ROS2 del robot (sensores, base kobuki, etc).

El segundo modo lo veremos con posterioridad, de momento usaremos el escritorio remoto.

## Conexión con el escritorio remoto (RDP)

La conexión con el robot se puede hacer mediante RDP, que es un protocolo para acceder a escritorios remotos. **No es necesario que tengas ROS2 instalado en tu ordenador** ya que usarás el instalado en el robot.

Necesitarás una aplicación cliente RDP para conectar con el robot. En windows ya hay una integrada, en Linux puede ser que la tengas instalada o no (la más típica se llama Remmina).

**Asegúrate primero de conectar tu PC con la red wifi del laboratorio**, el nombre de la red comienza por "labrobot". Usa a ser posible las que llevan un 5 en el nombre, son las de 5Ghz y deberían tener un mayor ancho de banda Esta wifi por cuestiones de seguridad no tiene salida a Internet, de modo que cuando estés conectado a ella no tendrás acceso a internet salvo que tu PC tenga otro adaptador de red adicional.

En la pizarra del aula debería estar escrita la contraseña de la wifi.

Una vez conectado a la wifi, para conectar con el escritorio remoto del robot necesitas dos datos:

- Su IP: está en una etiqueta pegada al robot y tiene el formato 192.168.1.X.
- El usuario y la contraseña para entrar, que estarán escritos en la pizarra

Ahora tienes que ejecutar la aplicación de escritorio remoto:

- Si estás en windows, puedes usar `mstsc`. Abre el cuadro de diálogo "Ejecutar" (presiona Win + R). Escribe `mstsc` y presiona Enter o haz clic en Aceptar. Aparecerá un cuadro de diálogo "conexión a escritorio remoto". Donde pone "equipo" pon la IP del turtlebot. Luego te pedirá el usuario y contraseña.
- Si estás en linux puedes usar un cliente RDP como Remmina. En Mac tienes una aplicación en la App Store que se llama `Windows App`.


## Arranque de la base del robot 

Para arrancar la base del robot:

```bash
ros2 launch kobuki kobuki.launch.py
```

El robot debería emitir unos pitidos que van de grave a agudo indicando que la base ha arrancado correctamente (cuando emite los pitidos de agudo a grave indica que algo ha fallado y se ha parado el proceso).

## Mover al robot con el teclado

Para mover al robot puedes usar el nodo `teleop_twist_keyboard`. **En una nueva terminal**, teclea:

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

Para que la teleoperación funcione, **la terminal donde se está ejecutando debe tener el foco del teclado, o sea estar en primer plano**

## Arranque del laser

Para lanzar el laser, **en una nueva terminal**:

```bash
# pone en marcha el nodo del laser
ros2 launch urg_node2 urg_node2.launch.py &
# provisionalmente especifica la relación entre el sistema de coordenadas del laser y el cuerpo del robot
ros2 run tf2_ros static_transform_publisher 0 0 0 1 0 0 0 base_link laser
```


Si quieres, puedes visualizar el *scan* del laser en RViz: 

- Arrancar rviz con el comando `rviz2`. 
- Poner la opción `global frame` a `odom`. 
- Añadir una visualización para el laser (botón `Add` abajo a la izquierda > en el listado `By Display Type` seleccionar `LaserScan`). 
- Una vez añadida aparecerá en el panel de la izquierda, cambiar el `topic` a `/scan`. Deberían aparecer unas líneas blancas con las distancias detectadas por el laser.

## Arranque de la cámara

Para arrancar la cámara RGBD pasa el parámetro `astra:=True` cuando arranques la base:

```bash
ros2 launch kobuki kobuki.launch.py astra:=True
```

Puedes visualizar las imágenes de la cámara en RViz2, pero también lo puedes hacer con un nodo llamado `rqt_image_view`:

```bash
ros2 run rqt_image_view rqt_image_view
```

En la ventana que aparecerá debes seleccionar el topic que contiene las imágenes que quieres ver, la cámara del robot publica un topic con las imágenes RGB y otro en tonos de gris con las profundidades.

## Copiar archivos desde y hacia el robot

> **NO BORREIS NINGUN ARCHIVO QUE NO SEA VUESTRO** podríais hacer que el robot dejara de funcionar

> **IMPORTANTE**: si copiais vuestro código al robot real para ejecutarlo, tened en cuenta que ya existe un workspace llamado `ros2_ws` que no se puede modificar. LLamad al vuestro de forma distinta y borradlo tras la sesión de trabajo.

En el modo de escritorio remoto todo el código que se ejecuta reside físicamente en el robot, así que para trabajar en él tenéis que copiarlo en un *pendrive* o con un software especial. Para copiar archivos entre tu PC y el escritorio remoto:

- Si tu ordenador es Windows puedes instalarte el programa [WinSCP](https://winscp.net/eng/download.php). 

<!--
- Si tu ordenador es Ubuntu Linux **TO-DO: COMO HACERLO EN LINUX EN MODO GRAFICO**
-->

- Si tu ordenador es otro Linux o Mac puedes usar la orden de línea de comandos **scp**. El formato del comando es `scp archivo_origen destino`, por ejemplo para copiar un archivo llamado `datos.zip` que está en el directorio base del usuario del robot, harías **desde tu ordenador** `scp turtlebot@ip-del-turtlebot:~/datos.zip .`. Te pedirá la contraseña y copiará el archivo.


