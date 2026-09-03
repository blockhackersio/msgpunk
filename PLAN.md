To get the first incarnation of this we need to look at steps separately


Step 1: DONE! Connect client and Server
- Add a healthcheck route to the server
- create a script that runs the server locally and sends it through cfup.sh to get a url and sets this url on the client while running the client through devenv shell with the env var passed in that is the cloudflare url for the server
- Get the client to make a request from the server through it's env var. This can be a button that requests the tauri function which makes an http request to the server healthcheck based on the injected env var. 

Step 2: NOW Android Interface
- Fixed form structure (NO form builder).
    - Form is a basic contact us form and includes: 
      1. Signal Account
      2. What should I call you?
      3. Your Message
- Screens
    - Onboarding Seed generation (Do not test just generate and allow a way to backup later)
    - Add Form (Automatically add the contact form above) -> Publish (deploy form to server)
    - View Responses (Show response list "Response from 'Dirk Digler'")
        - View Response (Show detailed decrypted response)

