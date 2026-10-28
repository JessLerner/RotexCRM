# Configuración del piloto Supabase

## 1. Crear el proyecto

1. Crear un proyecto gratuito exclusivo para Rotex, sin conectar todavía Nave Gestión Comercial.
2. En **Authentication > Providers**, mantener email/contraseña y desactivar el registro público. Las cuentas las crea administración.
3. En **Authentication > URL Configuration**, agregar `http://localhost:5173` y, al publicar, el dominio Cloudflare Pages.
4. Copiar la URL del proyecto y la publishable/anon key a `.env.local` usando `.env.example`. Nunca copiar `service_role` al navegador ni al repositorio.

## 2. Aplicar el esquema

Desde SQL Editor, ejecutar el archivo `supabase/migrations/20261027235000_rotex_core.sql` completo. Antes de cargar personas reales, revisar que las políticas RLS queden habilitadas en todas las tablas.

## 3. Primer acceso administrativo

Crear primero el usuario de administración desde Authentication. Luego, usando SQL Editor y su UUID, ejecutar:

```sql
insert into public.profiles (id, display_name, role, status)
values ('UUID_DEL_USUARIO', 'Administración Rotex', 'administracion', 'active');
```

Las siguientes altas deberán hacerse mediante la pantalla administrativa que se incorpora en la siguiente parte de la Fase 2. No eliminar perfiles: cambiar su estado a `inactive` conserva el historial.

## 4. Límites del piloto

No cargar leads reales hasta finalizar repositorios persistentes, importador y pruebas de RLS. El plan Free no ofrece backup administrado ni continuidad garantizada; exportar el esquema y datos de prueba antes de cambios grandes.
