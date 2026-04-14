module.exports = {

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    PATCH(req, res){
        res.json({ message: 'PATCH request received' })
    },
}
