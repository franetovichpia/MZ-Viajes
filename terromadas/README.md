# Terromadas – sitio + panel

Sitio público: `index.html`  ·  Panel privado: `admin.html`

## Probar en tu compu (modo demo, sin configurar nada)
    git clone https://github.com/franetovichpia/mz-viajes.git
    cd mz-viajes && git checkout claude/gracious-meitner-dg47nh
    cd terromadas && python3 -m http.server 8000
Abrir http://localhost:8000 (sitio) y http://localhost:8000/admin.html (clave demo: `terromadas`).

## Publicarlo de verdad (Firebase, plan gratuito)
1. https://console.firebase.google.com → Crear proyecto → agregar app Web → copiar `firebaseConfig`.
2. Authentication → Sign-in method → habilitar **Correo/contraseña** → Users → **Add user** (correo y clave del dueño). No habilitar registro público.
3. Firestore Database → Crear base de datos (modo producción).
4. Pegar `firebaseConfig` en `js/config.js`.
5. En `firestore.rules` reemplazar `DUENO@CORREO.COM` por el correo del dueño.
6. Desplegar:

       npm i -g firebase-tools
       firebase login
       firebase use --add        # elegir el proyecto
       firebase deploy

7. Entrar a `https://TU-PROYECTO.web.app/admin.html`, cargar ajustes (WhatsApp, link de "Armá tu viaje") y paquetes.
