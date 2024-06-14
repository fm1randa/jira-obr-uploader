# Jira OBR Uploader

Uploads many OBRs at once to any Jira Server :fire:

## Run Locally

Clone the project

```bash
git clone https://github.com/fm1randa/jira-obr-uploader
```

Go to the project directory

```bash
cd jira-obr-uploader
```

Switch to the Node version specified in the `.nvmrc` file

```bash
nvm install
```

Install dependencies

```bash
npm install
```

Start the server

```bash
npm start
```

## Usage

### Changing port

```bash
npm start 8080
# Server is running on http://localhost:8080
```

### Changing driver options

Avaliable options:

- `headless` (boolean)
- `disableGpu` (boolean)
- `noSandbox` (boolean)

Create a `options.json` file at the project root

```json
{
  "headless": true,
  "disableGpu": true,
  "noSandbox": true
}
```

:bulb: The setup above is useful to hide the Chrome window.

## Screenshot

![image](https://github.com/fm1randa/jira-obr-uploader/assets/35941797/7f89f6d8-b8e6-421b-b7cd-9f8a4af2daa1)
