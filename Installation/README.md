**See full setup guide in root of project**

How to start it up:

- npm install

- create .env with:
```text
NODE_ENV=development
VITE_SOCKET_URL=http://laptop-ip:443
VITE_CLIENT_URL=http://laptop-ip:5173
VITE_API_KEY=api-token //found my-lenses -> apps -> id's and tokens
VITE_GROUP_ID=group-id //found my-lenses -> lens scheduler -> int4 
VITE_OBJECT_API_SPEC_ID=api-spec-id //found my-lenses -> api's 
VITE_LENS_ID_1=lens-id //found my-lenses -> lens scheduler -> int4 -> lens
VITE_LENS_ID_2=lens-id //found my-lenses -> lens scheduler -> int4 -> lens


SUPABASE_URL=supabase-url
SUPABASE_KEY=service-key-not-anon
SUPABASE_BUCKET=bucket-name
CLIENT_URL=http://localhost:5173

```

- npm run dev to start both node.js server and vite front-end

