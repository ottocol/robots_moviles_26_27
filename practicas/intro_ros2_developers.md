# Introducción a ROS 2 para desarrolladores

La filosofía básica de ROS 2 sigue siendo la misma que en ROS 1: distribuir el código en nodos que intercambian mensajes, pero a la hora de programar, las herramientas de desarrollo, la API y la organización del código fuente en paquetes ha cambiado en algunos aspectos. Vamos a ver aquí una pequeña introducción a la programación en ROS2 con Python para que nos sirva de base para el desarrollo de las prácticas.


## 1. Workspaces y packages

En ROS 2 los conceptos de workspace y packages son iguales que en ROS 1 pero hay bastantes diferencias prácticas en cuanto a los comandos para compilar, crear paquetes, etc.

|       | ROS 1 (catkin) | ROS 2 (ament + colcon) |
|------|----------------|------------------------|
|Nombre del workspace: | `catkin_ws` por convención | `ros2_ws` por convención |
|Compilar con: | `catkin_make` | `colcon build` |
|"Instalar" el workspace en el shell: | `source devel/setup.bash` | `source install/setup.bash` |
|Crear un paquete: | `catkin_create_pkg` | `ros2 pkg create` |

### Crear un workspace

> En los ordenadores del laboratorio verás que hay un *workspace* ya creado que se llama `ros2_ws`. Ahí están instalados los paquetes para trabajar con los Turtlebot 2. Para ver el proceso desde cero, mejor vamos a crear el nuestro propio.

```bash
# 1. Crea el workspace y su src
mkdir -p mi_ros2_ws/src
cd mi_ros2_ws

# 2. Compila aunque esté vacío para generar la estructura de directorios (build, install, log)
colcon build
```

Cada vez que abras una terminal para trabajar con este workspace necesitas hacer un `source` del *script* `install/setup.bash` para poder acceder desde la terminal a los paquetes y a los nodos ROS que crees en el workspace.

```bash
source mi_ros2_ws/install/setup.bash
```

> Puedes añadir la línea anterior al final de tu ~/.bashrc si siempre usas el mismo workspace.

### Crear un package

Los paquetes residen en el directorio `src` del *workspace*:


1. **Métete en el directorio `src`** del *workspace* que creaste 

    ```bash
    cd mi_ros2_ws/src
    ```

2. **Ejecuta la orden `ros2 pkg create`** para crear el paquete. Hace falta darle un nombre y decir si es de tipo Python o C++ y de qué otros paquetes depende (en nuestro caso `rclpy`, que contiene las APIs básicas para trabajar con Python y `std_msgs` que contiene los tipos de mensaje básicos como cadenas, enteros, arrays, etc)

    ```bash
    ros2 pkg create practica0 --build-type ament_python --dependencies rclpy std_msgs
    ```


Si todo es correcto, el comando anterior habrá creado un nuevo directorio `practica0` y la estructura de directorios del código fuente será algo como:

```text
mi_ros2_ws/
└── src/
    └── practica0/            # Paquete ROS
        ├── package.xml       # Metadatos y dependencias ROS
        ├── setup.py          # Instalación y ejecutables Python
        ├── setup.cfg         # Destino de los ejecutables
        ├── resource/
        │   └── practica0
        └── practica0/        # Paquete Python
            └── __init__.py.  # Archivo que identifica este directorio como paquete python
```
En esta estructura, Nuestro código python irá en `mi_ros2_ws/src/practica0/practica0/`.


## 2. Ejemplo productor/consumidor

Como ROS está basado en el paso de mensajes, algunos nodos publicarán mensajes y otros los consumirán (aunque puede haber alguno que haga las dos cosas). Por eso uno de los ejemplos más típicos de introducción a ROS es el productor/consumidor: un nodo produce mensajes (que para simplificar son de texto plano) y otro nodo los consume (y los muestra en pantalla).

Vamos a crear el nodo que produce los mensajes, generando 1 mensaje de texto cada segundo. El código de los nodos de ROS 2 debe ir dentro de una carpeta que se habrá creado dentro de la principal del paquete y también con el nombre del paquete (en nuestro caso la carpeta será `practica0/practica0`, y si miras dentro de ella verás que tiene un archivo llamado `__init__.py`, que en python se usa para "marcar" que una carpeta es un paquete python). Al archivo lo podemos llamar `productor.py`.

```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class Productor(Node):
    def __init__(self):
        super().__init__('productor')
        self.pub = self.create_publisher(String, 'saludo', 10)
        self.timer = self.create_timer(1.0, self.timer_callback)  # 1 Hz
        self.count = 0

    def timer_callback(self):
        msg = String()
        msg.data = f'saludo numero {self.count}'
        self.pub.publish(msg)
        self.get_logger().info(msg.data)
        self.count += 1

def main():
    rclpy.init()
    node = Productor()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

#solo sirve por si queremos ejecutarlo con "python3 productor.py"
if __name__ == '__main__':
    main()    
```

Sobre este código:

- `create_timer(1.0, ...)` programa una llamada periódica, aproximadamente a 1 Hz. 
- El `10` del publicador es el tamaño del historial de mensajes. Limita la cantidad de mensajes que se guardan si un suscriptor no los recibe suficientemente rápido.
- `rclpy.spin()` mantiene al ejecutor esperando trabajo y ejecutando los callbacks del nodo. Cuando no hay trabajo, espera; cuando lo hay —por ejemplo, llega un mensaje o vence un temporizador— ejecuta el callback correspondiente y vuelve a esperar. En este caso solo puede vencer un temporizador, en el siguiente ejemplo veremos un callback de recepción de mensaje.


Podríamos ejecutar el nodo simplemente yendo al directorio en el que esté `productor.py` y ejecutando `python3 productor.py`, o dándole al archivo permiso de ejecución con `chmod ugo+x productor.py` y ejecutándolo con `./productor.py`.

No obstante, la forma recomendada de ejecutar nodos en ROS2 es con `ros2 run`. Para que este comando funcione, nos falta modificar la configuración del paquete. Dentro de `src/practica0` hay dos archivos de configuración, `setup.py` y `setup.cfg`. De momento solo necesitamos modificar el primero.

En `setup.py`, dentro de la sección `console_scripts` definimos los nodos python del paquete, en nuestro caso:

```python
#resto del archivo setup.py...
entry_points={
        'console_scripts': [
            # como ves, el formato es:  ejecutable = paquete.modulo:función por donde empezar
            'productor = practica0.productor:main'
        ],
},
```

ya "solo" nos falta compilar, actualizar las variables de entorno con el `setup.bash` del workspace y probar a ejecutar el nodo

```bash
#estando en el directorio "mi_ros2_ws"
colcon build --symlink-install
source install/setup.bash 
ros2 run practica0 productor
```
> El parámetro `--symlink-install` nos ahorra tener que hacer `colcon build` cada vez que modifiquemos un archivo `.py`

Nos faltaría el nodo que recibe los mensajes generados por el productor, al que llamaremos `consumidor` para seguir con la tradición. En el archivo `src/practica0/practica0/consumidor.py` pondríamos:


```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class Consumidor(Node):
    def __init__(self):
        super().__init__('consumidor')
        self.sub = self.create_subscription(
            String,
            'saludo',
            self.listener_callback,
            10)

    def listener_callback(self, msg):
        self.get_logger().info(f'Recibido: {msg.data}')

def main():
    rclpy.init()
    node = Consumidor()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

#solo sirve por si queremos ejecutarlo con "python3 consumidor.py"
if __name__ == '__main__':
    main()      
```

Por supuesto tendríamos que modificar el `setup.py` para reflejar la existencia del nuevo nodo:

```python
#resto del archivo setup.py...
entry_points={
        'console_scripts': [
            # formato:  ejecutable = paquete.modulo:función
            'productor = practica0.productor:main',
            'consumidor = practica0.consumidor:main'
        ],
},
```

Necesitaríamos hacer de nuevo el `colcon build` desde el directorio `mi_ros2_ws` ya que hemos creado un archivo nuevo (no solo hemos editado uno existente), y ya podríamos ejecutarlo con `ros2 run practica0 consumidor`.

Como curiosidad, puedes observar el resultado desde una tercera terminal:

```bash
ros2 node list
ros2 topic list -t
ros2 topic info /saludo --verbose
ros2 topic echo /saludo
```

## 3. Interactuando con un robot

### 3.1 Simulando el robot

El ejemplo del productor/consumidor se usa mucho para introducir a la programación en ROS porque es sencillo de entender, pero lo cierto es que directamente no tiene mucho que ver con robots. A partir de ahora vamos a escribir ejemplos en los que recibamos mensajes de los sensores de un robot y enviemos mensajes a los efectores para moverlo.

Lo primero que necesitamos, evidentemente, es un robot. Como es lógico resulta más sencillo simularlo que usar uno real, aunque lo interesante de ROS es que el código que desarrollemos debería funcionar exactamente igual con la simulación que con el robot real. Por sencillez, en estos apuntes usaremos un simulador.

De momento en los ordenadores de los laboratorios hay dos simuladores instalados: Gazebo y mvsim. 
Escribe esto primero en una terminal para preparar las variables de entorno

```bash
#Actualizar variables de entorno para ROS. solo si no lo has hecho ya en esta terminal
source /opt/ros/jazzy/setup.bash
```

En el simulador mvsim:

```bash
ros2 launch mvsim demo_turtlebot_world.launch.py use_rviz:=False
```

O alternativamente, con un Turtlebot 2 simulado en Gazebo (**CUIDADO, esta simulación todavía no está instalada en los laboratorios**):

```bash
#Para que funcionen los paquetes de Turtlebot 2
source ~/ros2_ws/install/setup.bash
ros2 launch kobuki simulation.launch.py
```

### 3.2 Leyendo mensajes de los sensores (consumidor)

Vamos a escribir el código de un nodo que lea las distancias devueltas por el LIDAR 2D y imprima en pantalla la distancia al obstáculo más cercano y al más lejano. En la simulación del Turtlebot 2 en Gazebo el topic del laser 2D se llama `/scan_raw`. En la del Turtlebot 3 de mvsim se llama `/laser1`.

El código lo tenéis aquí, podéis guardarlo en un archivo del workspace `src/practica0/practica0/distancias.py`

⚠️ En el siguiente código cambia el `/laser1` por `/scan_raw` si estás usando la simulación de Turtlebot 2

```python
#!/usr/bin/env python3
#lee las distancias devueltas por el LIDAR 2D e imprime la más cercana y la más lejana
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
import math

class ReadScan(Node):
    def __init__(self):
        super().__init__('distancias')
        self.sub = self.create_subscription(
            LaserScan,
            '/laser1',
            self.callback,
            10)

    def callback(self, msg):
        # filtra los “inf” generados cuando no hay eco y los valores fuera de rango
        rangos = [r for r in msg.ranges if not math.isinf(r) and msg.range_min <= r <= msg.range_max]
        if not rangos:
            return
        self.get_logger().info(
            f'más cercano: {min(rangos):.3f} m  | más lejano: {max(rangos):.3f} m')

def main():
    rclpy.init()
    node = ReadScan()
    rclpy.spin(node)
    rclpy.shutdown()

#solo sirve por si queremos ejecutarlo con "python3 distancias.py"
if __name__ == '__main__':
    main() 
``` 


Este código introduce una nueva dependencia en el paquete, que es `sensor_msgs`. Por eso tendremos que abrir el archivo `package.xml` y añadir `sensor_msgs` con una nueva etiqueta `<depend>`. 

Como hemos añadido un archivo `.py` que es un nodo ROS, tendremos que volver a hacer toda la parafernalia de:

1. Modificar el `setup.py`
2. Volver a compilar con `colcon build --symlink-install`

No damos las instrucciones detalladas ya que a estas alturas deberíais saberlo hacer vosotros :).

## 3.3 Publicando comandos de velocidad (productor)

La simulación que estamos usando emplea `/cmd_vel` como *topic* asociado a los motores. Este *topic* admite mensajes de tipo `Twist`, que básicamente son comandos de velocidad lineal y angular. Aquí tenéis un ejemplo de un nodo que permite teleoperar al robot con el teclado.

```python
#!/usr/bin/env python3
import sys, tty, termios        
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist

class Teleop(Node):
    def __init__(self):
        super().__init__('teleoperacion')
        self.pub = self.create_publisher(Twist, '/cmd_vel', 10)
        print("a = adelante | z = izquierda | x = derecha | q = salir")

def main():
    rclpy.init()
    node = Teleop()

    # nos peleamos con la terminal para ponerla en modo 'cbreak' (procesar pulsaciones de tecla sin tener que pulsar INTRO)
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)   # guardamos la configuración actual
    tty.setcbreak(fd)             # modo cbreak: lee de a 1 carácter

    try:
        while rclpy.ok():
            key = sys.stdin.read(1)  # bloquea hasta pulsar algo

            if key in ('q', '\x03'):   # 'q' o Ctrl-C
                break

            cmd = Twist()
            if key == 'a':
                cmd.linear.x = 0.25
                cmd.angular.z = 0.0
            elif key == 'z':
                cmd.linear.x = 0.25
                cmd.angular.z = 0.75 # recordad que en ROS el giro positivo es a izquierdas
            elif key == 'x':
                cmd.linear.x = 0.25
                cmd.angular.z = -0.75
            else:
                continue            # tecla no válida, ignoramos

            node.pub.publish(cmd)
            rclpy.spin_once(node, timeout_sec=0.0)  # por si ROS tuviera que procesar algo (en este ejemplo no es necesario, pero es buena práctica)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)  # restaurar terminal
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()

```

> El código se complica un poco por el uso de las librerías `sys`, `tty` y `termios` que nos permiten procesar el teclado sin necesidad de pulsar INTRO después de cada tecla (poniendo a la terminal en un modo especial que se llama *cbreak*), pero no os perdáis en esos detalles, no son importantes.

Tened en cuenta que este código añade una nueva dependencia que es `geometry_msgs`, por lo que habrá que editar el `package.xml` e incluir una nueva etiqueta `<depend>`.

Y otra vez hemos creado un nuevo nodo, por lo que tendremos que modificar el `setup.py` y recompilar.


### 3.4  Nodo que recibe LaserScan y publica Twist (consumidor + productor)

Podemos combinar la recepción y publicación de mensajes en un único nodo que haga de consumidor y productor a la vez. Aquí tenéis un ejemplo que implementa un algoritmo muy sencillo de evitación de obstáculos.

⚠️ En el siguiente código cambia el `/laser1` por `/scan_raw` si estás usando la simulación de Turtlebot 2 en Gazebo

```python
#!/usr/bin/env python3
import math

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from geometry_msgs.msg import Twist

THRESH = 0.4      # m, umbral de seguridad
SPEED_NORMAL = 0.25
SPEED_SLOW = 0.1
TURN_NORMAL   = 0.5      # rad/s, giro normal
TURN_FAST   = 1.5      # rad/s, giro de emergencia (siempre izquierda)


class SimpleAvoid(Node):
    def __init__(self):
        super().__init__('simple_avoid')
        self.pub = self.create_publisher(Twist, '/cmd_vel', 5)
        #CUIDADO!!! con el nombre del topic, verifica que se llama así, y si no cámbialo por el que sea
        self.sub = self.create_subscription(LaserScan, '/laser1', self.cb, 10)

    def cb(self, msg: LaserScan):
        # Índices de los dos rayos a +-20° respecto al frente.
        idx_izq20 = int(round(( math.radians(20) - msg.angle_min) / msg.angle_increment))
        idx_der20 = int(round((-math.radians(20) - msg.angle_min) / msg.angle_increment))

        # Distancias medidas en esos indices (Si es infinito lo ponemos a rango máximo).
        d_der = msg.ranges[idx_der20] if math.isfinite(msg.ranges[idx_der20]) else msg.range_max
        d_izq = msg.ranges[idx_izq20] if math.isfinite(msg.ranges[idx_izq20]) else msg.range_max

        cmd = Twist()

        if min(d_der, d_izq) < THRESH:
            # Obstáculo muy cerca → gira fuerte a la izquierda para evitar colisión
            cmd.angular.z = TURN_FAST
            cmd.linear.x = SPEED_SLOW
        else:
            # Gira hacia el rayo más despejado.
            cmd.angular.z = TURN_NORMAL if d_izq > d_der else -TURN_NORMAL
            cmd.linear.x = SPEED_NORMAL

        self.pub.publish(cmd)


def main():
    rclpy.init()
    rclpy.spin(SimpleAvoid())
    rclpy.shutdown()


if __name__ == '__main__':
    main()
```

> Tomaros el código anterior simplemente como ejemplo de nodo que a la vez publica en algunos topics y está suscrito a otros, no como un algoritmo útil para evitación de obstáculos, ya que fallará en muchos casos.

Como siempre, al haber creado un nuevo nodo tendremos que modificar el `setup.py` y recompilar.