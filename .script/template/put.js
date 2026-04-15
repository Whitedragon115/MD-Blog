module.exports = {

    auth: true,

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    PUT(req, res){
        res.json({ message: 'PUT request received' })
    },
}
