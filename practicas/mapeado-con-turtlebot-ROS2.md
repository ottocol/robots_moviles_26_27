# Sesión de trabajo con los Turtlebot: Mapeado, localización y navegación

<!--

- TO-DO: afinar la transformación entre el frame `laser` y `base_link`, tenemos la rotación OK pero no la traslación
- TO-DO: cómo se copian archivos de rdp?
- TO-DO: ¿qué pasa con el ruido en el mapa? ¿se puede limpiar, se puede usar un filtro de scan?
- TO-DO: cómo se conecta con RDP en Remmina

-->

En esta sesión de trabajo presencial con los Turtlebots vamos a probar los algoritmos de mapeado, localización y navegación ya implementados en ROS.

La práctica la haréis por grupos. Cada grupo realizará unos videos y un documento conjunto, firmado por todos los miembros. Ese documento lo entregaréis uno solo de los miembros del grupo en una tarea especial de moodle.

Los objetivos son:

- **Aprender a conectarse con los robots reales**.
- **Visualizar en rviz2 los datos captados por los sensores del robot**: en concreto el laser.
- **Probar el mapeado y localización** con el robot real.
- **Probar la navegación autónoma** haciendo que el robot vaya de manera autónoma de un punto a otro sin chocar con obstáculos previstos e imprevistos.

## Conexión con el robot

La conexión con el robot se puede hacer mediante RDP, que es un protocolo para acceder a escritorios remotos. **No es necesario que tengas ROS2 instalado en tu ordenador** ya que usarás el instalado en el robot.

Necesitarás una aplicación cliente RDP para conectar con el robot. En windows ya hay una integrada, en Linux puede ser que la tengas instalada o no (la más típica se llama Remmina).

**Asegúrate de conectar tu PC con la red wifi del laboratorio**, recuerda que el nombre de la red comienza por "labrobot". Usa a ser posible las que llevan un 5 en el nombre, son las de 5Ghz y deberían tener un mayor ancho de banda. En la pizarra del aula debería estar escrita la contraseña de la wifi. Esta wifi por cuestiones de seguridad no tiene salida a Internet, de modo que cuando estés conectado a ella no tendrás acceso a internet salvo que tu PC tenga otro adaptador de red adicional.

Para conectar con el robot necesitas dos datos:

- Su ip: está en una etiqueta pegada al robot y tiene el formato 192.168.1.X.
- El usuario y la contraseña para entrar, que estarán escritos en la pizarra

Ahora tienes que ejecutar la aplicación de escritorio remoto:

- Si estás en windows, puedes usar `mstsc`. Abre el cuadro de diálogo "Ejecutar" (presiona Win + R). Escribe `mstsc` y presiona Enter o haz clic en Aceptar. Aparecerá un cuadro de diálogo "conexión a escritorio remoto". Donde pone "equipo" pon la ip del turtlebot. Luego te pedirá el usuario y contraseña.
- Si estás en linux puedes usar un cliente RDP como Remmina.


## Arranque básico del robot y pruebas con el laser

Para arrancar la base del robot:

```bash
ros2 launch kobuki kobuki.launch.py
```

El robot debería emitir unos pitidos que van de grave a agudo indicando que la base ha arrancado correctamente (cuando emite los pitidos de agudo a grave indica que algo ha fallado y se ha parado el proceso).

Para lanzar el laser, en otra terminal:

```bash
ros2 launch urg_node2 urg_node2.launch.py
```

Para que ROS2 pueda calcular las transformaciones entre el sistema de coordenadas del laser (que aquí se llama `laser`) y el resto de sistemas, hay que proporcionar la relación con alguno de ellos, por ejemplo con `base_link`, la parte "central" de la base del robot. En otra terminal ejecuta:

```bash
ros2 run tf2_ros static_transform_publisher 0 0 0 1 0 0 0 base_link laser
```

Esta transformación indica que el laser está rotado 180 grados en el eje X (cabeza abajo). La orden debe quedarse ejecutando todo el rato igual que el resto.

Arrancar rviz con el comando `rviz2`. Pon el global frame a `odom` ya que todavía no existe un `map`. Añadir una visualización para el laser (botón `Add` abajo a la izquierda > en el listado `By Display Type` seleccionar `LaserScan`). Una vez añadida aparecerá en el panel de la izquierda, cambiar el `topic` a `/scan`. Deberían aparecer unas líneas blancas con las distancias detectadas por el laser.

Para ver en RViz a dónde está mirando el robot puedes añadir sus ejes de coordenadas: botón `Add` abajo a la izquierda > en el listado `By Display Type` seleccionar `Axes`. Una vez añadido, en el panel de la izquierda desplegar el `Axes` y cambiar el Reference frame a `base_link`. El eje rojo es el X, que apunta hacia el frente, el Y el verde y el Z el Azul (siguiendo el orden clásico R-G-B). 

**Entregable**: Captura una pantalla en la que se vean las lecturas del laser (o haz una foto a la pantalla) y luego con algún programa gráfico señala qué es lo que estaba "percibiendo" el robot en cada zona (poniendo un texto en cada zona que diga por ejemplo "pared", "mesa", "persona",...). Adjúntalo a la documentación escrita.

> En el escritorio remoto no se pueden directamente copiar archivos. Para copiar archivos entre tu PC con Windows y el escritorio remoto puedes usar [WinSCP](https://winscp.net/eng/download.php). 

## Mapeado

Recuerda que para construir el mapa del entorno debes ejecutar en una terminal:

```bash
ros2 launch slam_toolbox online_async_launch.py 
```

Para mover al robot puedes usar el nodo `teleop_twist_keyboard`:

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

Para que la teleoperación funcione, **la terminal donde se está ejecutando debe tener el foco del teclado, o sea estar en primer plano**, tendrás que apañártelas para que a la vez puedas ver por debajo la ventana de rviz2 con el mapa.

Cuando veas que ya se ha mapeado todo el entorno puedes guardar el mapa ejecutando en otra terminal:

```bash
ros2 run nav2_map_server map_saver_cli -f mimapa  #o el nombre que le quieras dar
```

**Entregable** en la documentación escrita incluye una imagen del mapa generado. Explica brevemente qué tal se ha generado el mapa ¿te parece un buen mapa, tiene artefactos (elementos que no son reales)?.

## Localización

```bash
ros2 launch nav2_bringup localization_launch.py map:=el_archivo_de_mi_mapa.yaml
```

IMPORTANTE: antes de marcar la posición inicial del robot cambia en rviz, en las `global options` el `fixed frame` a `map`

Marca la posición inicial del robot con la opción de la barra de herramientas `2D pose estimate`. Pulsa sobre ella y luego en el mapa, clica en la posición que creas que está el robot y arrastra hacia la dirección en la que mira, verás que aparece una flecha verde indicando esta posición y dirección.

Recuerda que:

- Para ver la posición estimada en todo momento por el algoritmo AMCL, añadir un display `by topic` -> `/amcl_pose` / `PoseWithCovariance`. Cambiar el `Durability Policy` a `Transient Local` igual que hiciste con el mapa. 

- Para ver la nube de partículas: añadir display (en este caso tiene que ser `by display type` ya que el topic no aparece por defecto). Dentro de `nav2_rviz_plugins` seleccionar `ParticleCloud`. El topic debe ser `/particle_cloud` y en Reliability: BEST_EFFORT y  Durability: VOLATILE. Cuando añadas el display ten en cuenta que inicialmente no verás las partículas si el robot no se está moviendo porque amcl no las publica cuando el robot está quieto. Luego ya se verán todo el rato. 

**Entregable** incluye un video (lo puedes grabar con el móvil) del robot moviéndose por el entorno y que se vea lo mejor posible en la pantalla por dónde cree el robot que se está moviendo.


## Navegación

El siguiente paso es conseguir que el robot navegue de forma autónoma hasta un punto. 

Asegúrate de que tienes parados los procesos de localización, mapeado y teleoperación y para también el del laser ya que lo arrancaremos de nuevo con otros parámetros. Cierra también rviz2. Solo debería quedar arrancada la base del robot (`kobuki.launch.py`) y la transformación del frame del laser al de la base.

El archivo de configuración de navegación del paquete `kobuki` espera que el topic del laser sea `scan_filtered`. Para no tener que cambiar este valor, una solución sencilla es volver a lanzar el laser pero ahora con este nuevo topic.

```bash
ros2 launch urg_node2 urg_node2.launch.py scan_topic_name:=scan_filtered
```

Para arrancar todo el conjunto de nodos de navegación, además pondrá en marcha rviz en "modo navegación":

```bash
ros2 launch kobuki navigation.launch.py map:=el_archivo_de_tu_mapa.yaml
```
> Además del mapa verás en tonos rojos y azules dibujadas una especie de "zonas de seguridad" alrededor de los obstáculos. Esto es lo que se llama el *costmap*. La idea es que no deberíamos acercarnos demasiado a las zonas ocupadas del mapa. Una forma de evitarlo es marcando esas celdas como que tienen un coste de movimiento alto, para que el algoritmo de planificación de rutas las evite. Visualmente estas zonas de "coste alto" se ven en esos tonos rojos y azules. Alrededor de donde está el robot (o cree estar) verás dibujado otro *costmap*, el *local costmap*, que se va moviendo con el robot. Ya hablaremos de estos *costmap* en clase de teoría.

Tendrás que decirle al robot cuál es su pose inicial con el botón `2D Pose Estimate` y marcando en la posición en la que está y indicarle la pose a la que quieres que vaya con el botón `Nav2 Goal`.

Podéis probar a poneros en la trayectoria del robot a ver qué hace cuando se encuentra con obstáculos imprevistos (pero dejadle alguna salida al pobre).

> A la izquierda en rviz2 tienes el panel de navegación, si en algún momento el robot se atasca puedes pulsar sobre `cancel` para cancelar el objetivo actual (aunque habrá veces que tengas que cerrar rviz y la navegación por completo).

**Entregable:** video de cómo seleccionáis el punto destino en la pantalla y cómo se mueve el robot real hasta el destino.

**Entregable**: explicad en la documentación escrita qué tal funciona la navegación, si consigue llegar bien al destino, si planifica correctamente las rutas, qué pasa si se encuentra algún obstáculo imprevisto...


## Baremo de puntuación y fecha de entrega

Como decía el enunciado de la práctica 2, la puntuación de esta entrega forma parte del baremo de la misma y se valora con 1 punto.

La documentación escrita y videos se deben entregar con un plazo máximo de 1 semana desde que se hizo la prueba. Si por ejemplo hacéis las pruebas el 27 de octubre deberíais entregarlo como máximo el 3 de noviembre hasta las 23:59 (la tarea seguirá abierta para que la entregue el resto de la gente pero el sistema guarda la fecha de entrega, que se revisará).

Solo hace falta que lo entregue uno de los miembros del grupo a través de su cuenta de moodle pero evidentemente en la documentación debéis poner el nombre de todos.