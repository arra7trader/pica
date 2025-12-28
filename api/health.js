module.exports = (req, res) => {
    res.status(200).json({
        status: 'online',
        service: 'PICA Terminal (Vercel)',
        time: new Date().toISOString()
    });
};
