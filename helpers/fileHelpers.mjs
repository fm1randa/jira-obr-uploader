import fs from "fs";

// Helper function to delete files
function deleteFiles(files) {
  for (const file of files) {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error(`Error deleting file ${file.path}:`, err);
      } else {
        console.log(`Successfully deleted file ${file.path}`);
      }
    });
  }
}

export { deleteFiles };
