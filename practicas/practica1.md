# Robots Móviles 2026-27. Grado de Ingeniería Robótica, Universidad de Alicante
# Práctica 1: De los sensores al mapa: medir, moverse y experimentar

## 0. Introducción

En esta práctica vamos a introducir la problemática del ruido en los sensores y en los movimientos del robot, que nos afectarán a la hora de realizar tareas como el mapeado del entorno y la estimación de la posición actual del robot. Mediremos experimentalmente los errores en sensores y movimiento y veremos cómo influyen en el mapeado.

### Simulador vs. robot real

Esta práctica implica trabajo con el simulador y también con el robot real. **El tiempo con el robot real debería dedicarse a ejecutar el código, realizar experimentos y recoger datos, NO A ESCRIBIR EL CODIGO EN ESE MOMENTO**. Debéis llegar al turno de robot con el código probado en el simulador y un plan de experimentos preparado. Para los apartados 1 y 3 si necesitáis hacer alguna prueba y no tenéis el robot real disponible podéis usar los ROSbag que se dejan en el moodle, son grabaciones de los topics reales del robot y es como si estuviérais trabajando con él (aunque no se puede controlar su trayectoria).

> **IMPORTANTE**: si copiais vuestro código al robot real para ejecutarlo, tened en cuenta que ya existe un workspace llamado `ros2_ws` que no se puede modificar. LLamad al vuestro de forma distinta y borradlo tras la sesión de trabajo.

### Uso de IA para desarrollar la práctica

En esta práctica puedes usar IA para ayudarte en las tareas. De hecho te recomendamos que lo hagas, la IA te puede ayudar a escribir el código mucho más rápidamente, generar gráficos, planificar los experimentos,... lo que no debería pasar es que:

- La IA sustituya tu juicio o tu espíritu crítico sacando conclusiones por tí. 
- Algunas partes del trabajo queden justificadas "porque así las hizo la IA". Tú eres el responsable de todo lo que entregas desde el código Python a las conclusiones. Aunque la IA haya hecho cualquier parte del trabajo tú deberías poder justificarla y si es código poder explicar cómo funciona.

### Plantilla para la práctica

En Github tienes una plantilla de un workspace de ROS2 para comenzar con la práctica, contiene un mundo muy simple con un Turtlebot 2 simulado.

```bash
git clone https://github.com/ottocol/prac1_robots_moviles_2627 ./robots_moviles_ws
```

y luego como pone en el `README.md`

```bash
cd robots_moviles_ws
#para incluir el workspace en el path
colcon build --symlink-install
source install/setup.bash
#para arrancar la simulación
ros2 launch prac1 simulacion.launch.py
```


## 1. Medidas con el láser 2D

Nuestros Turtlebot 2 tienen un sensor laser 2D modelo [Hokuyo ust-10lx](https://www.hokuyo-aut.jp/search/single.php?serial=167#spec), con un alcance nominal de 10 m. (dependiendo de la superficie puede ser menor), una resolución angular de 0.25° y un campo de visión de 270°. 

El laser es bastante preciso, pero no da siempre la misma medida exacta aunque el robot esté quieto.

> La simulación incluye errores en las medidas de los sensores, pero los parámetros de error no son los del laser real, no uses las medidas simuladas para hacer una estimación del error.

**Tarea 1.1** (simulador): escribe un nodo ROS2 que sin mover al robot tome el rayo más cercano a 0° (el frente del robot, dirección del eje X) y guarde las medidas en un archivo.

**Tarea 1.2** (robot real): ejecuta el código anterior y pon al robot enfrente de una pared u otro obstáculo grande a una distancia conocida (necesitarás un metro). Hazlo para un par de distancias. Guarda también datos de qué pasa si:

- si pones al robot un poco de lado con respecto a la pared (no del todo frontal)
- si lo pones enfrente del cristal de la pecera del laboratorio
- si lo pones mirando al cristal pero un poco de lado (no del todo frontal)

**Tarea 1.3** (evaluación de resultados): dibuja histogramas de los datos para los distintos casos e intenta ajustar alguna distribución de probabilidad a los datos, por el medio que consideres más apropiado, y explica los resultados obtenidos (qué tipo de distribución usas, si varía con la distancia, el ángulo con que se percibe el obstáculo o el material del mismo).

## 2. Odometría

La base del robot es un modelo llamado [Kobuki](https://iclebo-kobuki.readthedocs.io/en/latest/). Mantiene actualizada la posición del robot en el topic `/odom` fusionando la información que proporcionan los *encoders* de las ruedas y el giroscopio interno. Como cualquier sistema de odometría tiene un error que se va acumulando en el tiempo. El objetivo de este apartado es medirlo en lo posible.

**Tarea 2.1** (simulador): escribe un nodo ROS2 que haga que el robot se mueva en un cuadrado de 1 m de lado de manera que vuelva otra vez al punto de partida. Haz que el tamaño del cuadrado y la velocidad lineal y angular se puedan cambiar fácilmente en el código, luego lo necesitarás. En cada trayectoria (avance/giro/avance/giro/avance/giro/avance/giro) el robot sabrá que ha recorrido el lado del cuadrado o girado los 90° por la odometría.

**Tarea 2.2**(robot real): prueba el nodo del cuadrado en el robot real y mide lo mejor que puedas lo que se ha desviado del punto de partida. Repítelo al menos un par de veces. Prueba con un cuadrado de 1 m y una velocidad lineal de al menos 0.2 m/s y angular de al menos 0.5 rad/s. Si te da tiempo puedes probar con:

- distintas velocidades lineales y angulares 
- distintos tamaños de cuadrado 
- otros recorridos, por ejemplo moverse n metros hacia adelante, girar 180 grados y volver al punto de partida. 
- el giroscopio de la base kobuki desactivado, para ver si influye en el error y cómo. Para arrancar la base sin giroscopio:

```bash
#La base no debería estar arrancada en ninguna otra terminal
ros2 run kobuki_node kobuki_ros_node --ros-args \
-r __node:=kobuki_ros_node \
--params-file "$(ros2 pkg prefix --share kobuki)/config/kobuki_node_params.yaml" \
-p use_imu_heading:=false \
-r /commands/velocity:=/cmd_vel
```

**Tarea 2.3** (evaluación de resultados): indica los errores obtenidos en los diferentes experimentos y explica las diferencias en los resultados entre cada experimento.

## 3. El mapa "de un solo rayo" 

para crear un mapa del entorno a partir de los datos del laser tenemos que transformar las distancias al sensor en coordenadas $(x,y)$ de un sistema de referencia externo al robot. Para este propósito podemos usar `odom` que es un sistema de referencia cuyo $(x=0,y=0,\theta=0)$ está en la posición de la que parte el robot cuando arranca la base.

> Nota: si en algún momento quieres fijar el $(0,0,0)$ de la odometría en el punto y orientación en que está el robot ahora mismo, puedes mandar un mensaje *vacío* al topic `/commands/reset_odometry`. Lo puedes hacer desde código Python o desde la terminal: `ros2 topic pub --once /commands/reset_odometry std_msgs/msg/Empty "{}"`.

**Tarea 3.1** (simulador): programa un nodo de ROS2 que, tomando un único rayo del laser en la dirección que creas más conveniente, vaya convirtiendo las distancias leídas por ese rayo en coordenadas del sistema `odom` y las guarde en un archivo para poder representarlas gráficamente más tarde. Prueba el mapa en el mundo simulado.

**Tarea 3.2** (robot real): prueba tu algoritmo de mapeado "de un solo rayo" en el robot real y guarda los resultados en archivos, para poder representarlos gráficamente con posterioridad. A ser posible haz varias pruebas en distintos "entornos" (dentro del laboratorio de robótica, en los pasillos,...).

***Tarea 3.3** (evaluación de resultados) ¿En qué partes del laboratorio o adyacentes (pasillos, etc) funciona mejor?. ¿Qué problemas tiene el mapa, tiene algún tipo de defecto? Intenta buscar las causas y explica cómo podrías mejorarlo. Incluye varios mapas de forma gráfica en la memoria.

Aunque lo llamemos mapeado "de un solo rayo" puedes tomar varios si lo prefieres, así el mapa se generará más rápido. No lo hagas con todos, se complicará el tratamiento de datos, eso se propone en una de las ampliaciones.

## 4. Ampliaciones

Con las tareas descritas hasta ahora puedes optar a un máximo de un 7 en la nota. Si quieres más nota puedes realizar alguna de las siguientes ampliaciones:

### 4.1 Uso de la profundidad de la cámara 3D (1 punto)

Los robots tienen una cámara RGBD que calcula distancias proyectando patrones de luz estructurada. La cámara es una [Orbbec Astra](https://www.orbbec.com/products/structured-light-camera/astra-series/).

Toma uno o varios pixeles de la imagen y comprueba en el robot real si varía la distancia en varias medidas con el robot quieto más o menos que en el laser. Construye el mapa "de un solo rayo" con información de un pixel en lugar de un rayo de laser y comprueba las diferencias con el mapa de laser, si las hay.

> El topic de la cámara con la imagen de profundidad es `/depth/image_raw`.

### 4.2 Programar la odometría desde cero (1 punto)

Escribe un nodo de ROS que calcule una odometría propia a partir de los *ticks* de los encoders. Tendrás que buscar información sobre cómo convertir estos ticks a distancia, y con las ecuaciones de la cinemática directa podrás estimar $(x,y,\theta)$ actualizándolos cada pequeño intervalo de tiempo. 

En el robot real, los datos de los *encoders* están junto con otros sensores básicos en el topic `/sensors/core`.

> En la simulación no tienes datos de los *encoders*, para probar este apartado necesitas usar un ROSbag (apéndice 2) y cuando lo tengas funcionando lo puedes probar en el robot real.


### 4.3 El mapa "de todos los rayos" (1 punto)

Lo habitual en robótica móvil es usar toda la información de cada *scan* de laser, no un único rayo. En ese caso cada *scan* nos dará una "nube de puntos 2D"

- Las nubes de puntos se representan en ROS con mensajes de tipo `sensor_msgs/msg/PointCloud2`. Se pueden visualizar en RViz2 con un display de tipo `PointCloud2`.
- Se pueden transformar los valores del scan directamente en una nube de puntos con la clase `LaserProjection`. Investigad su uso. Está en el paquete `ros-jazzy-laser-geometry` (o en lugar de `jazzy` la versión que sea). Este paquete debería estar instalado en los laboratorios, pero si usáis otra distribución aseguráos de que lo instaláis.
- Conforme la nube global se vaya haciendo más grande, mantener todos los puntos será ineficiente. Podéis *voxelizar* los puntos, lo que quiere decir dividir el espacio en una cuadrícula y guardar solo un punto por cada pequeño cuadrado. Si un nuevo punto cae dentro de un cuadrado ya ocupado, no lo añadimos. Investigad el tema.

## Baremo de evaluación y fecha de entrega

Qué se debe entregar:

- Una memoria en formato pdf en la que detalléis todo el trabajo realizado, debería incluir figuras con los histogramas de las medidas, los mapas creados, etc.
- Todo el código Python
- Todos los archivos de datos "en crudo" que hayan generado los diferentes experimentos: medidas de sensores, mapas generados...
- Un video explicativo de unos 5 minutos donde contéis cómo funciona el código que habéis usado para realizar los experimentos y las conclusiones obtenidas
    - No es necesario que hagáis una presentación de diapositivas, lo podéis contar sobre el pdf de la memoria y sobre el código fuente en un editor
    - Tampoco es necesario que se os vea a vosotros, solo que se os oiga
    - No perdáis tiempo cortando el video y volviendo a grabar si os equivocáis, no importa. Lo único que quiero es que expliquéis lo que habéis hecho, no que lo hagáis perfecto, no es el objetivo.

La entrega de la práctica es **individual**. No obstante como la experimentación con el robot real la hacéis en común habrá partes que sean iguales que otras entregas, por ejemplo los ficheros de datos o los mapas. Las conclusiones ya no tienen por qué ser las mismas. En las tareas con el robot real indicad en la memoria con quién más las habéis realizado.

La fecha de entrega límite para la práctica es el **13 de octubre a las 23:59**. La entrega se realizará por moodle en un único .zip con todos los archivos. Para el video lo mejor sería que lo subiérais a Youtube y lo pusiérais privado compartiendo enlace o lo compartiérais en Google Drive pero también podéis añadirlo al .zip si os cabe.


## Apéndice 1: Transformación de coordenadas en ROS2

En cualquier robot móvil hará falta en general más de un sistema de coordenadas. Por ejemplo, sensores como las cámaras 3D o los láseres, cuando detectan información lo hacen en su propio sistema de referencia (los ejes coinciden con la posición física del sensor), pero típicamente no coincidirán con los ejes del cuerpo del robot. Por otro lado, el sistema de referencia del cuerpo del robot se mueve conforme se mueve éste, pero necesitamos también sistemas externos "fijos". Por ejemplo, el sistema de coordenadas de un mapa del entorno.

Esto hace que habitualmente sea necesario transformar coordenadas de un sistema a otro. Por ejemplo, en nuestro caso **necesitamos transformar las coordenadas de los puntos detectados por el láser a coordenadas del mapa**, para poder ir construyéndolo. Afortunadamente ROS nos va a ayudar mucho en esta tarea.

En el [REP (ROS Enhancement Proposal) 105](https://www.ros.org/reps/rep-0105.html) se definen una serie de sistemas de coordenadas estándar para robots móviles. Los que nos interesan de momento son los siguientes:

- `base_link`: El sistema de coordenadas de la plataforma base del robot. Es un sistema local al robot, que se mueve cuando este se mueve. Típicamente se coloca en el centro de rotación del robot.
- `odom`: Este sistema de coordenadas está fijo en el mundo (no se mueve cuando se mueve el robot) y su origen y orientación cero coincide con la posición de partida del robot. Es lo que se conoce habitualmente como *odometría*: conforme el robot se va moviendo también va estimando su posición actual con respecto a este sistema.
- `map`: Es un sistema de coordenadas asociado a un mapa del entorno. Está fijo en el mundo (no se mueve cuando se mueve el robot) y su origen y orientación cero es arbitrario y depende de quien haya creado el mapa. El robot puede estimar su posición con respecto a este sistema comparando el mapa con lo que perciben actualmente los sensores. Esto se conoce como *localización* (lo veremos en la práctica 2).

> De momento no usaremos `map`, sino `odom` como sistema de referencia externo al robot.

Además, como usaremos un láser para detectar obstáculos, tendremos un sistema asociado a él. El nombre en el Turtlebot 2 es `laser`, y es en el que se obtienen las medidas del láser.

ROS2 mantiene las relaciones conocidas entre sistemas de coordenadas en un grafo que se conoce como *grafo de transformaciones*. Que aparezca una arista que va de un nodo A a un nodo B indica que ROS conoce la matriz que transforma el sistema A en el B. Si conocemos la transformación de A a B también tenemos la de B a A, ya que es la matriz inversa, de modo que la dirección del arco no es importante.

En un grafo de transformaciones **podemos calcular la transformación entre dos sistemas cualesquiera A y B siempre que haya un camino entre ambos**, sin importar la dirección de las flechas. 

Aunque parezca antiintuitivo, **la transformación que lleva de un sistema A al sistema B, en realidad nos sirve para pasar puntos dados en el sistema B al sistema A**.

Por ejemplo, supongamos que queremos pasar un punto dado en el sistema `laser` al sistema `odom` y por tanto necesitamos la transformación de `odom` a `laser`. Si le pidiéramos a ROS2 que nos dibujara el grafo de transformaciones veríamos que hay un camino que une ambos nodos, de modo que podemos pedirle a ROS la transformación, 


```python
import rclpy, math
from rclpy.node import Node
from geometry_msgs.msg import PointStamped
from tf2_ros import Buffer, TransformListener
from tf2_geometry_msgs import do_transform_point
from sensor_msgs.msg import LaserScan
from rclpy.time import Time
import tf2_ros

class TFExample(Node):
    def __init__(self):
        super().__init__('tf_example_py')
        self.buffer = Buffer(node=self)
        self.listener = TransformListener(self.buffer, self)  # usa el clock del nodo
        # En el Turtlebot real el topic del laser es /scan, en el simulador será distinto
        self.sub = self.create_subscription(LaserScan, '/scan', self.laser_recibido, 10)

    def laser_recibido(self, msg):
        try:
            # En el Turtlebot msg.header.frame_id es "/laser"
            # Cogemos la transformación correspondiente a cuando se hizo el scan del laser
            tf = self.buffer.lookup_transform('odom', msg.header.frame_id, Time.from_msg(msg.header.stamp))
            # Queremos transformar el rayo que apunta a este angulo. Aquí ponemos a piñón 0 como ejemplo
            angulo = math.radians(0)
            # indice del rayo que apunta en ángulo "angulo"
            idx_rayo = int(round(( angulo - msg.angle_min) / msg.angle_increment))
            distancia = msg.ranges[idx_rayo]
            # Punto en coordenadas del laser
            p_in = PointStamped()
            p_in.header.frame_id = msg.header.frame_id
            p_in.point.x = distancia * math.cos(angulo)
            p_in.point.y = distancia * math.sin(angulo)
            p_in.point.z = 0.0
            p_out = do_transform_point(p_in, tf)
            print(f'{p_in.point} en laser es {p_out.point} en odom')
        except (tf2_ros.TransformException,) as ex:
            self.get_logger().warn(f'TF2 error: {ex}')

def main():
    rclpy.init()
    node = TFExample()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

## Apéndice 2: ROSBag

Un ROSBag es una grabación de los mensajes que se publican en los *topics* de ROS en un intervalo de tiempo dado. Así podemos grabar todo lo que percibe el robot, las órdenes que recibe, etc. Como es una grabación lo que no podemos hacer es controlar el movimiento del robot, solo podemos reproducir el movimiento que siguió originalmente. No obstante, lo percibido por el robot durante el camino original sí será exactamente igual que los mensajes del robot real, por lo que cualquier experimento que no requiera controlar al robot lo podemos hacer con un ROSBag sin necesidad de cambiar código. En nuestro caso nos servirá para las secciones 1 y 3 aunque no para la 2, ya que en la medición de la odometría tenéis que controlar que el robot siga un cuadrado.

En la página de moodle de la práctica hay unos cuantos ROSBag grabados con un Turtlebot del laboratorio, si necesitáis experimentar algo de las secciones 1 y 3 o las ampliaciones podéis hacerlo con estos ROSBag si no tenéis acceso al robot real. En las versiones modernas de ROS2 los datos se graban en un formato llamado `mcap`.

Para reproducir un ROSBag se usa el comando:

```bash
ros2 bag play fichero_mcap
```

Esto hará que la reproducción comience inmediatamente así que antes de hacer play poned vuestros nodos en funcionamiento (por ejemplo el que construya el mapa "de un solo rayo")

Un ROSbag seguramente no contendrá todos los topics del robot, solo los que se hayan querido grabar, si queréis ver cuáles contiene, haced:

```bash
ros2 bag info fichero_mcap
```
os mostrará la duración, número de mensajes, topics, y los tipos y número de mensajes grabados por cada topic.

Para visualizar el contenido de un ROSbag podéis usar la herramienta de ROS2 `rqt_bag` pasándole el directorio donde está el .mcap. También podéis usar una herramienta web llamada [Foxglove](https://foxglove.dev/product/visualization), que funciona algo mejor. Elegid la opción de "Open local file".

Podéis grabar vuestros propios rosbag de manera sencilla, así podréis reproducir el mismo experimento las veces que queráis. El comando es `record` y tenéis que pasar una lista con los topics que queráis grabar, por ejemplo 

```bash
ros2 bag record /depth/image_raw /scan /odom
```

grabaría la imagen de profundidad, el scan de laser y la odometría. Si vais a hacer transformaciones de coordenadas (por ejemplo para la tarea 3) deberíais grabar también `/tf`. y `/tf_static`.