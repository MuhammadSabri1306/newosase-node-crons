const main = port => {
    
    const portName = port && port.port_name ? port.port_name : null;
    if(portName == "Status PLN")
        return true;
    if(portName == "Status DEG")
        return true;
    return false;

};

module.exports = main;