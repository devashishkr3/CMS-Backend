const express = require("express");
const router = express.Router();

router.get("/", (req, res) =>{
    res.send("Hello Bro <h1> kya ho raha hai <h1>");
})

module.exports = router;