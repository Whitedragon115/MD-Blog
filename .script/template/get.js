module.exports = {

    auth: true,

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    GET(req, res){
        res.json({ message: 'GET request received' })
    },
}
