# Generar un mapa de octomap a partir de un Rosbag 

## 0. Instalar (solo la primera vez)

```bash
sudo apt install ros-$ROS_DISTRO-octomap-server ros-$ROS_DISTRO-depth-image-proc
```

## 1. Terminal 1: nube de puntos a partir de la profundidad

```bash
ros2 run depth_image_proc point_cloud_xyz_node --ros-args \
  -r image_rect:=/depth/image_raw \
  -r camera_info:=/depth/camera_info \
  -r points:=/nube \
  -p use_sim_time:=true
```

## 2. Terminal 2: servidor de OctoMap

```bash
ros2 run octomap_server octomap_server_node --ros-args \
  -r cloud_in:=/nube \
  -p frame_id:=odom \
  -p resolution:=0.05 \
  -p sensor_model.max_range:=4.0 \
  -p use_sim_time:=true
```

Los dos nodos se quedan esperando sin hacer nada hasta que llegue el reloj del bag; es lo normal.

## 3. Terminal 3: reproducir el bag

```bash
ros2 bag play mi_bag --clock
```

Opcionalmente, en RViz pon Fixed Frame a odom y añade un MarkerArray con el topic /occupied_cells_vis_array para ver el mapa crecer.

## 4. Terminal 4: guardar el mapa

Hazlo cuando termine el bag, sin cerrar el servidor:

```bash
ros2 run octomap_server octomap_saver_node --ros-args -p octomap_path:=mapa.bt
```

Para verlo:

```bash
octovis mapa.bt
```