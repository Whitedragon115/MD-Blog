module.exports = {

    auth: true,

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    POST(req, res){
        res.json({ message: 'POST request received' })
    },
}
