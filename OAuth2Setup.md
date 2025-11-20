# OAuth2 Setup Guide

To set up Google OAuth2 for your application, follow these steps:

1. **Create a Google Cloud Project**  
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).

   - Click on the project drop-down and select "New Project".
    ![Google OAuth Screenshot](./image/1.png)
    ![Google OAuth Screenshot](./image/2.png)
   - Enter a project name and click "Create".
   ![Google OAuth Screenshot](./image/3.png)

2. **Client , Project Configuration**  
    - after creating project click "client " on side menu and select "Get Started" to setup OAuth consent screen.
    ![Google OAuth Screenshot](./image/4.png)
    - Fill information and select "External" and click "Create".
    ![Google OAuth Screenshot](./image/5.png)
3. **OAuth Consent Screen Configuration**  
    - Go to "Overview" and click "Create Oauth Client".
    ![Google OAuth Screenshot](./image/6.png)
    - Select "Web application" as the application type and put your project name.
    - In "Authorized javascript origins", add:

      ```
      http://localhost:5173
      http://127.0.0.1:5173
        ```

    - In "Authorized redirect URIs", add:

        ```
        http://127.0.0.1:8000/api/auth/google/callback
        http://localhost:8000/api/auth/google/callback
        ```

    - before create make sure that you add everything correctly as shown below *
    ![Google OAuth Screenshot](./image/7.png)
    - Click "Create" and save your credentials as json.
    ![Google OAuth Screenshot](./image/8.png)
    ![Google OAuth Screenshot](./image/9.png)
4. **Enable Google classroom API**  
    - Go to "Library" in side menu and search for "Google Classroom API".
    ![Google OAuth Screenshot](./image/10.png)
    - Click on it and then click "Enable".
    ![Google OAuth Screenshot](./image/11.png)
    - After enabling, go to "OAuth consent screen" in side menu. and
    ![Google OAuth Screenshot](./image/12.png)
    - clcik "Data acessss" and select "add scope" and add the following scopes:
      ![Google OAuth Screenshot](./image/13.png)
    - Adding these scopes will allow your application to access Google Classroom data on behalf of the users. one by one add all the scopes shown below:

    - <https://www.googleapis.com/auth/userinfo.email>
    - <https://www.googleapis.com/auth/userinfo.profile>
    - <https://www.googleapis.com/auth/classroom.courses.readonly>
    - <https://www.googleapis.com/auth/classroom.student-submissions.me.readonly>
    - <https://www.googleapis.com/auth/classroom.coursework.me>

      ![Google OAuth Screenshot](./image/14.png)
    - After adding all the scopes click "update & save".
    ![Google OAuth Screenshot](./image/15.png)
    ![Google OAuth Screenshot](./image/16.png)
5. **Audience Setting**  
    - Go to your google auth platoform and select "Audience" from side menu.
    ![Google OAuth Screenshot](./image/17.png)
    - under plusblishing status click "Publish App" and confirm.
    ![Google OAuth Screenshot](./image/18.png)
6. **Final Step**  
    - Go back to "Credentials" from side menu or the json that you download and copy your "Client ID" and "Client Secret" to your  backend `.env` file. from the steps in INSTALLATION.md and replace the following placeholders:

    ```env
    GOOGLE_CLIENT_ID=your_google_client_id_here
    GOOGLE_CLIENT_SECRET=your_google_client_secret_here
    ```

    - Now your Google OAuth2 setup is complete! You can now continue with the rest of the installation process to run your application.
