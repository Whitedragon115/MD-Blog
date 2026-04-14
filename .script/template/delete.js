module.exports = {

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    DELETE(req, res){
        res.json({ message: 'DELETE request received' })
    },
}
